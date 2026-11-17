"""
Azure AI Foundry Document RAG Service
FastAPI APIRouter mounted into ai_assistent.py app.
Provides endpoints for document upload, indexing, and RAG-based chat.
"""

import asyncio
import io
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel
from dotenv import load_dotenv

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import FileSearchTool, PromptAgentDefinition

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------

_current_dir = Path(__file__).resolve().parent
_python_service_dir = _current_dir.parent
for _env_candidate in [_python_service_dir / ".env", _current_dir / ".env"]:
    if _env_candidate.exists():
        load_dotenv(dotenv_path=_env_candidate)
load_dotenv()

_API_KEY = os.environ.get("API_KEY2", "")
_PROJECT_ENDPOINT_BASE = os.environ.get(
    "PROJECT_ENDPOINT2", "https://manifoundryresource3.services.ai.azure.com/"
)
# Full endpoint expected by AIProjectClient
_PROJECT_ENDPOINT = _PROJECT_ENDPOINT_BASE.rstrip("/") + "/api/projects/proj-default"
_MODEL_NAME = os.environ.get("MODEL_NAME", "gpt-5.2")

_AGENT_NAME = "u2tools-doc-rag-agent"
_VECTOR_STORE_NAME = "U2ToolsDocumentRAG"

_AGENT_INSTRUCTIONS = (
    "You are a document analysis assistant for U2 Tools. "
    "Use File Search to answer questions based on the uploaded documents. "
    "Do not invent facts that are not supported by the documents. "
    "If the answer is not available in the documents, clearly state that. "
    "Mention the relevant document or evidence when possible."
)

# ---------------------------------------------------------------------------
# In-memory state (persistent across requests)
# ---------------------------------------------------------------------------

_rag_state: dict = {
    "enabled": False,
    "agent_name": None,
    "agent_version": None,
    "vector_store_id": None,
    "documents": [],  # list of DocumentRecord dicts
}

# Cached Azure clients (created lazily, reused across calls)
_project_client: Optional[AIProjectClient] = None
_openai_client = None

# Cache for raw document bytes to support retry on failed uploads/indexing
_file_bytes_cache: dict = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_clients():
    """Return (project, openai_client), creating them once and caching."""
    global _project_client, _openai_client
    if _project_client is None:
        credential = DefaultAzureCredential()
        _project_client = AIProjectClient(
            endpoint=_PROJECT_ENDPOINT,
            credential=credential,
        )
        _openai_client = _project_client.get_openai_client()
    return _project_client, _openai_client


def _find_doc(doc_id: str) -> Optional[dict]:
    for doc in _rag_state["documents"]:
        if doc["id"] == doc_id:
            return doc
    return None


def _update_doc(doc_id: str, **kwargs):
    doc = _find_doc(doc_id)
    if doc is not None:
        doc.update(kwargs)


def _create_doc_record(name: str, size: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "size": size,
        "status": "upload_pending",
        "error": None,
        "file_id": None,
    }


# ---------------------------------------------------------------------------
# Background processing (sync functions run in threadpool by FastAPI)
# ---------------------------------------------------------------------------


def _process_document(doc_id: str, file_bytes: bytes, filename: str):
    """
    Background task: upload file to Azure vector store and update agent.
    Status progression:
        upload_pending → uploading → upload_completed →
        indexing_pending → indexing_in_progress → indexing_completed
    On error: failed
    """
    try:
        # 1. Mark as uploading
        _update_doc(doc_id, status="uploading", error=None)

        # 2. Get (or create) Azure clients
        project, openai_client = _get_clients()

        # 3. Ensure vector store exists
        if _rag_state["vector_store_id"] is None:
            vs = openai_client.vector_stores.create(name=_VECTOR_STORE_NAME)
            _rag_state["vector_store_id"] = vs.id

        vector_store_id = _rag_state["vector_store_id"]
        file_io = io.BytesIO(file_bytes)
        file_id = None

        # Attempt multi-stage upload & indexing for granular status tracking
        try:
            uploaded_file = openai_client.files.create(
                file=(filename, file_io),
                purpose="assistants"
            )
            file_id = uploaded_file.id
            _update_doc(doc_id, status="upload_completed", file_id=file_id)

            _update_doc(doc_id, status="indexing_pending")
            _update_doc(doc_id, status="indexing_in_progress")

            vs_file = openai_client.vector_stores.files.create_and_poll(
                vector_store_id=vector_store_id,
                file_id=file_id
            )
            if hasattr(vs_file, "status") and vs_file.status == "failed":
                last_err = getattr(vs_file, "last_error", None)
                msg = getattr(last_err, "message", "Vector store indexing failed") if last_err else "Vector store indexing failed"
                _update_doc(doc_id, status="failed", error=msg)
                return
        except Exception:
            # Fallback to direct upload_and_poll as in 2_Dynamic_Document_RAG.py
            file_io.seek(0)
            _update_doc(doc_id, status="indexing_in_progress")
            result = openai_client.vector_stores.files.upload_and_poll(
                vector_store_id=vector_store_id,
                file=(filename, file_io),
            )
            file_id = getattr(result, "id", None)
            _update_doc(doc_id, status="upload_completed", file_id=file_id)

        # 5. Mark indexing complete
        _update_doc(doc_id, status="indexing_completed", file_id=file_id)

        # 6. Ensure the RAG agent exists / is up-to-date
        _ensure_agent(project, openai_client)

    except Exception as exc:
        _update_doc(doc_id, status="failed", error=str(exc))


def _ensure_agent(project: AIProjectClient, openai_client):
    """Create or update the RAG agent with all current vector store files."""
    vector_store_id = _rag_state["vector_store_id"]
    if vector_store_id is None:
        return

    agent = project.agents.create_version(
        agent_name=_AGENT_NAME,
        definition=PromptAgentDefinition(
            model=_MODEL_NAME,
            instructions=_AGENT_INSTRUCTIONS,
            tools=[
                FileSearchTool(vector_store_ids=[vector_store_id])
            ],
        ),
        description="RAG agent for U2 Tools document analysis",
    )

    _rag_state["agent_name"] = agent.name
    _rag_state["agent_version"] = agent.version


def _retry_agent_creation(doc_id: str):
    """Background task: retry only agent creation for a doc whose file is already indexed."""
    try:
        _update_doc(doc_id, status="indexing_in_progress", error=None)
        project, openai_client = _get_clients()
        _ensure_agent(project, openai_client)
        _update_doc(doc_id, status="indexing_completed")
    except Exception as exc:
        _update_doc(doc_id, status="failed", error=str(exc))


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/rag", tags=["Document RAG"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class RagStatusResponse(BaseModel):
    enabled: bool
    agent_name: Optional[str] = None
    vector_store_id: Optional[str] = None
    documents: List[dict] = []
    ready: bool  # True when agent exists and all docs are indexing_completed


class RagChatRequest(BaseModel):
    message: str


class RagChatResponse(BaseModel):
    status: str
    response: str
    used_cloud_agent: bool


# ---------------------------------------------------------------------------
# Helpers for ready computation
# ---------------------------------------------------------------------------


def _compute_ready() -> bool:
    """
    Ready = enabled AND agent exists AND at least 1 doc is indexing_completed
            AND no doc is in a failed or in-progress state.
    """
    if not _rag_state["enabled"]:
        return False
    if _rag_state["agent_name"] is None:
        return False
    docs = _rag_state["documents"]
    if not docs:
        return False
    bad_statuses = {"failed", "uploading", "indexing_in_progress", "upload_pending"}
    has_completed = any(d["status"] == "indexing_completed" for d in docs)
    has_bad = any(d["status"] in bad_statuses for d in docs)
    return has_completed and not has_bad


def _status_response() -> RagStatusResponse:
    return RagStatusResponse(
        enabled=_rag_state["enabled"],
        agent_name=_rag_state["agent_name"],
        vector_store_id=_rag_state["vector_store_id"],
        documents=list(_rag_state["documents"]),
        ready=_compute_ready(),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status", response_model=RagStatusResponse)
async def get_rag_status():
    """Return current RAG state including readiness."""
    try:
        return _status_response()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/toggle", response_model=RagStatusResponse)
async def toggle_rag():
    """Toggle RAG enabled/disabled. Does NOT delete agent or vector store."""
    try:
        _rag_state["enabled"] = not _rag_state["enabled"]
        return _status_response()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    """
    Accept multipart file uploads. Each file is added to state immediately
    and processed in the background (upload → index → agent update).
    Returns the updated document list without waiting for processing.
    """
    try:
        for file in files:
            content = await file.read()
            filename = file.filename or "unknown"
            doc = _create_doc_record(filename, len(content))
            _rag_state["documents"].append(doc)
            _file_bytes_cache[doc["id"]] = (filename, content)
            background_tasks.add_task(
                _process_document, doc["id"], content, filename
            )
        return {"documents": list(_rag_state["documents"])}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/document/{doc_id}")
async def delete_document(doc_id: str):
    """
    Remove a document from the list.
    If it has a file_id, attempt to delete it from the vector store (fire-and-forget).
    Returns the updated document list.
    """
    try:
        doc = _find_doc(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

        _file_bytes_cache.pop(doc_id, None)

        # Fire-and-forget deletion from vector store
        file_id = doc.get("file_id")
        vector_store_id = _rag_state.get("vector_store_id")
        if file_id and vector_store_id:
            try:
                _, openai_client = _get_clients()
                openai_client.vector_stores.files.delete(
                    vector_store_id=vector_store_id,
                    file_id=file_id,
                )
            except Exception:
                pass  # Ignore errors — fire-and-forget

        _rag_state["documents"] = [
            d for d in _rag_state["documents"] if d["id"] != doc_id
        ]
        return {"documents": list(_rag_state["documents"]), "ready": _compute_ready()}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/retry/{doc_id}")
async def retry_document(doc_id: str, background_tasks: BackgroundTasks):
    """
    Reset a failed document back to upload_pending and re-trigger processing.
    Returns the updated document list.
    """
    try:
        doc = _find_doc(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        if doc["status"] != "failed":
            raise HTTPException(
                status_code=400,
                detail=f"Document {doc_id} is not in failed state (current: {doc['status']})",
            )

        doc["status"] = "upload_pending"
        doc["error"] = None

        if doc_id in _file_bytes_cache:
            filename, content = _file_bytes_cache[doc_id]
            background_tasks.add_task(
                _process_document, doc_id, content, filename
            )
        elif doc.get("file_id") and _rag_state.get("vector_store_id"):
            background_tasks.add_task(
                _retry_agent_creation, doc_id
            )
        else:
            doc["status"] = "failed"
            doc["error"] = "Original file not cached. Please remove and re-upload."

        return {"documents": list(_rag_state["documents"])}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/chat", response_model=RagChatResponse)
async def rag_chat(req: RagChatRequest):
    """
    Send a message to the RAG agent.
    Returns an error response if RAG is not enabled or not ready.
    """
    try:
        if not _rag_state["enabled"]:
            return RagChatResponse(
                status="error",
                response="RAG is not enabled. Please enable it first.",
                used_cloud_agent=False,
            )

        if not _compute_ready():
            return RagChatResponse(
                status="error",
                response=(
                    "RAG agent is not ready. "
                    "Please wait for all documents to finish indexing."
                ),
                used_cloud_agent=False,
            )

        _, openai_client = _get_clients()

        response = openai_client.responses.create(
            input=req.message,
            extra_body={
                "agent_reference": {
                    "name": _rag_state["agent_name"],
                    "type": "agent_reference",
                }
            },
        )

        output_text = getattr(response, "output_text", None)
        if not output_text:
            output_text = str(response)

        return RagChatResponse(
            status="success",
            response=output_text,
            used_cloud_agent=True,
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
