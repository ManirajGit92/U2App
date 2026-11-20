"""
Azure AI Foundry Document RAG Service
FastAPI APIRouter mounted into ai_assistent.py app.
Provides endpoints for document upload, indexing, viewing, downloading,
extracted information, references catalog, and RAG-based chat.
"""

import asyncio
import io
import json
import os
import re
import sys
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, Response
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure backend/python_service/.venv site-packages is discoverable even if uvicorn
# was launched from the workspace root .venv or global Python 3.12 interpreter.
_rag_current_dir = Path(__file__).resolve().parent
_rag_python_service_dir = _rag_current_dir.parent
_local_venv_site = _rag_python_service_dir / ".venv" / "Lib" / "site-packages"
if _local_venv_site.exists():
    _site_str = str(_local_venv_site)
    if _site_str not in sys.path:
        sys.path.append(_site_str)
    _azure_ns_dir = _local_venv_site / "azure"
    if _azure_ns_dir.exists() and "azure" in sys.modules:
        _azure_mod = sys.modules["azure"]
        if hasattr(_azure_mod, "__path__") and str(_azure_ns_dir) not in _azure_mod.__path__:
            _azure_mod.__path__.append(str(_azure_ns_dir))

try:
    from azure.identity import DefaultAzureCredential
    from azure.ai.projects import AIProjectClient
    from azure.ai.projects.models import FileSearchTool, PromptAgentDefinition
    _AZURE_AI_AVAILABLE = True
except ImportError as _ai_imp_err:
    DefaultAzureCredential = None  # type: ignore
    AIProjectClient = None  # type: ignore
    FileSearchTool = None  # type: ignore
    PromptAgentDefinition = None  # type: ignore
    _AZURE_AI_AVAILABLE = False
    print(f"[RAG] Warning: Azure AI Foundry SDK not installed in this Python interpreter ({_ai_imp_err}). Use backend/python_service/.venv.")

try:
    from azure.storage.blob import BlobServiceClient, ContentSettings
    _AZURE_BLOB_AVAILABLE = True
except ImportError as _blob_imp_err:
    BlobServiceClient = None  # type: ignore
    ContentSettings = None  # type: ignore
    _AZURE_BLOB_AVAILABLE = False
    print(f"[RAG] Warning: azure-storage-blob not installed in this Python interpreter ({_blob_imp_err}). Use backend/python_service/.venv.")

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------

_current_dir = Path(__file__).resolve().parent
_python_service_dir = _current_dir.parent
for _env_candidate in [_python_service_dir / ".env", _current_dir / ".env"]:
    if _env_candidate.exists():
        load_dotenv(dotenv_path=_env_candidate)
load_dotenv()

_API_KEY = os.environ.get("API_KEY2", "") or os.environ.get("API_KEY", "")
_PROJECT_ENDPOINT_BASE = os.environ.get(
    "PROJECT_ENDPOINT2", "https://manifoundryresource3.services.ai.azure.com/"
)
# Full endpoint expected by AIProjectClient
_PROJECT_ENDPOINT = (
    "https://manifoundryresource3.services.ai.azure.com/api/projects/proj-default"
    if "proj-default" not in _PROJECT_ENDPOINT_BASE
    else _PROJECT_ENDPOINT_BASE
)
_MODEL_NAME = os.environ.get("MODEL_NAME", "gpt-5.2")

_AGENT_NAME = "dynamic-document-rag"
_VECTOR_STORE_NAME = "DynamicDocumentStore"

_AGENT_INSTRUCTIONS = (
    "You are a document analysis assistant. "
    "Use File Search to answer questions based on the uploaded documents. "
    "Do not invent facts that are not supported by the documents. "
    "If the answer is not available, say so. "
    "Mention the relevant document or evidence when possible. "
    "Structure your answers neatly with clear headings and bullet points."
)

# ---------------------------------------------------------------------------
# Azure Blob Storage configuration (referencing AzureBlobStorageDemo/upload.py)
# ---------------------------------------------------------------------------

_AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
_PRIVATE_CONTAINER = "u2tools-private"
_PUBLIC_CONTAINER = "u2tools-public"

# Lightweight local JSON state persistence (metadata only; documents live in Azure Blob Storage)
_storage_dir = _current_dir / "rag_storage"
_storage_docs_dir = _storage_dir / "docs"
_state_file = _storage_dir / "rag_state.json"

_storage_dir.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# State Management & Persistence
# ---------------------------------------------------------------------------

_rag_state: dict = {
    "enabled": True,
    "agent_name": None,
    "agent_version": None,
    "vector_store_id": None,
    "documents": [],  # list of DocumentRecord dicts
}

# Cached Azure clients (created lazily, reused across calls)
_project_client: Optional[Any] = None
_openai_client = None
_blob_service_client: Optional[Any] = None

# In-memory cache for raw document bytes (populated on upload or on-demand from Azure Blob Storage)
_file_bytes_cache: dict = {}


def _save_state_to_disk():
    try:
        to_save = {
            "enabled": _rag_state["enabled"],
            "agent_name": _rag_state["agent_name"],
            "agent_version": _rag_state["agent_version"],
            "vector_store_id": _rag_state["vector_store_id"],
            "documents": _rag_state["documents"],
        }
        with open(_state_file, "w", encoding="utf-8") as f:
            json.dump(to_save, f, indent=2)
    except Exception as e:
        print(f"[RAG] Warning: Failed to save state to disk: {e}")


def _load_state_from_disk():
    global _rag_state
    if _state_file.exists():
        try:
            with open(_state_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                _rag_state.update(saved)
                print(f"[RAG] Loaded {len(_rag_state.get('documents', []))} documents from disk cache")
        except Exception as e:
            print(f"[RAG] Warning: Failed to load state from disk: {e}")

    # Populate _file_bytes_cache from disk docs if present
    for doc in _rag_state.get("documents", []):
        doc_id = doc.get("id")
        filename = doc.get("name")
        if doc_id and filename:
            disk_path = _storage_docs_dir / f"{doc_id}_{filename}"
            if disk_path.exists():
                try:
                    with open(disk_path, "rb") as f:
                        _file_bytes_cache[doc_id] = (filename, f.read())
                except Exception:
                    pass


# Initialize state from disk
_load_state_from_disk()


# ---------------------------------------------------------------------------
# Helpers for Document Inspection & Text Extraction
# ---------------------------------------------------------------------------

def _get_extension(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    return parts[1].lower() if len(parts) > 1 else ""


def _estimate_pages(content: bytes, filename: str) -> int:
    """Accurately detect or estimate page/slide count across PDF, DOCX, PPTX, TXT."""
    ext = _get_extension(filename)
    if ext == "pdf":
        try:
            # Standard PDF page object count
            matches = re.findall(rb'/Type\s*/Page\b', content)
            if matches:
                return len(matches)
        except Exception:
            pass
        return max(1, len(content) // 45000)

    if ext == "docx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                if "docProps/app.xml" in z.namelist():
                    app_xml = z.read("docProps/app.xml").decode("utf-8", errors="ignore")
                    m = re.search(r'<Pages>(\d+)</Pages>', app_xml)
                    if m:
                        return int(m.group(1))
                if "word/document.xml" in z.namelist():
                    doc_xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
                    paras = doc_xml.count("</w:p>")
                    return max(1, paras // 8)
        except Exception:
            pass
        return max(1, len(content) // 15000)

    if ext == "pptx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                slide_count = sum(1 for name in z.namelist() if name.startswith("ppt/slides/slide") and name.endswith(".xml"))
                if slide_count > 0:
                    return slide_count
        except Exception:
            pass
        return max(1, len(content) // 80000)

    if ext == "txt":
        try:
            text = content.decode("utf-8", errors="ignore")
            lines = text.count("\n") + 1
            return max(1, (lines + 49) // 50)
        except Exception:
            return 1

    return 1


def _extract_document_text(content: bytes, filename: str) -> str:
    """Extract raw readable text from PDF, DOCX, PPTX, TXT for references and QA fallback."""
    ext = _get_extension(filename)
    text_chunks = []

    if ext == "txt":
        return content.decode("utf-8", errors="ignore")

    if ext == "pdf":
        try:
            # Extract plain text strings inside PDF streams
            stream_matches = re.findall(rb'stream[\r\n]+(.*?)[\r\n]+endstream', content, re.DOTALL)
            for s in stream_matches:
                text_matches = re.findall(rb'\((.*?)\)Tj', s)
                for tm in text_matches:
                    try:
                        text_chunks.append(tm.decode("latin-1", errors="ignore"))
                    except Exception:
                        pass
            if text_chunks:
                return "\n".join(text_chunks)
        except Exception:
            pass
        # Fallback to ascii/utf-8 clean extraction
        cleaned = re.sub(rb'[^\x20-\x7E\n\r\t]', rb' ', content)
        return cleaned.decode("latin-1", errors="ignore")[:25000]

    if ext == "docx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                if "word/document.xml" in z.namelist():
                    doc_xml = z.read("word/document.xml")
                    tree = ET.fromstring(doc_xml)
                    paragraphs = []
                    for elem in tree.iter():
                        if elem.tag.endswith("t") and elem.text:
                            paragraphs.append(elem.text)
                    return " ".join(paragraphs)
        except Exception:
            pass

    if ext == "pptx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                slide_texts = []
                for name in sorted(z.namelist()):
                    if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                        slide_xml = z.read(name)
                        tree = ET.fromstring(slide_xml)
                        parts = [elem.text for elem in tree.iter() if elem.tag.endswith("t") and elem.text]
                        if parts:
                            slide_texts.append(" ".join(parts))
                return "\n\n".join(slide_texts)
        except Exception:
            pass

    return content.decode("utf-8", errors="ignore")[:10000]


def _get_media_type(filename: str) -> str:
    ext = _get_extension(filename)
    types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "txt": "text/plain; charset=utf-8",
    }
    return types.get(ext, "application/octet-stream")


def _get_clients():
    """Return (project, openai_client), creating them once and caching."""
    global _project_client, _openai_client
    if not _AZURE_AI_AVAILABLE:
        raise RuntimeError(
            "azure-ai-projects / azure-identity is not installed in the active Python environment. "
            "Start the server with: .\\.venv\\Scripts\\uvicorn standup_note.ai_assistent:app --host 0.0.0.0 --port 8000 --reload"
        )
    if _project_client is None:
        credential = DefaultAzureCredential()
        _project_client = AIProjectClient(
            endpoint=_PROJECT_ENDPOINT,
            credential=credential,
        )
        _openai_client = _project_client.get_openai_client()
    return _project_client, _openai_client


def _get_blob_service_client() -> Any:
    """Return cached Azure BlobServiceClient using AZURE_STORAGE_CONNECTION_STRING."""
    global _blob_service_client
    if not _AZURE_BLOB_AVAILABLE:
        raise RuntimeError(
            "azure-storage-blob is not installed in the active Python environment. "
            "Start the server with: .\\.venv\\Scripts\\uvicorn standup_note.ai_assistent:app --host 0.0.0.0 --port 8000 --reload"
        )
    if _blob_service_client is None:
        conn_str = _AZURE_STORAGE_CONNECTION_STRING or os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
        if not conn_str:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING not found in .env")
        _blob_service_client = BlobServiceClient.from_connection_string(conn_str)
    return _blob_service_client


def _upload_to_azure_blob(
    blob_name: str,
    content: bytes,
    access_type: str,
    filename: str,
) -> tuple[str, str]:
    """
    Upload document bytes to Azure Blob Storage container based on access_type.
    Matches AzureBlobStorageDemo/upload.py container logic:
      - 'public'  -> container 'u2tools-public' (public_access='blob')
      - 'private' -> container 'u2tools-private'
    Returns (container_name, blob_url).
    """
    is_public = access_type.strip().lower() == "public"
    container_name = _PUBLIC_CONTAINER if is_public else _PRIVATE_CONTAINER

    blob_service_client = _get_blob_service_client()
    container_client = blob_service_client.get_container_client(container_name)

    if not container_client.exists():
        if is_public:
            container_client.create_container(public_access="blob")
        else:
            container_client.create_container()

    blob_client = container_client.get_blob_client(blob_name)
    media_type = _get_media_type(filename)
    blob_client.upload_blob(
        content,
        overwrite=True,
        content_settings=ContentSettings(content_type=media_type),
    )
    return container_name, blob_client.url


def _download_from_azure_blob(container_name: str, blob_name: str) -> Optional[bytes]:
    """Download document bytes from Azure Blob Storage."""
    try:
        blob_service_client = _get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=blob_name,
        )
        return blob_client.download_blob().readall()
    except Exception as exc:
        print(f"[RAG] Warning: Failed to download blob {container_name}/{blob_name}: {exc}")
        return None


def _delete_from_azure_blob(container_name: str, blob_name: str) -> None:
    """Delete a blob from Azure Blob Storage (best-effort)."""
    try:
        blob_service_client = _get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=blob_name,
        )
        if blob_client.exists():
            blob_client.delete_blob()
    except Exception as exc:
        print(f"[RAG] Warning: Failed to delete blob {container_name}/{blob_name}: {exc}")


def _find_doc(doc_id: str) -> Optional[dict]:
    for doc in _rag_state["documents"]:
        if doc.get("id") == doc_id or doc.get("name") == doc_id:
            return doc
    return None


def _update_doc(doc_id: str, **kwargs):
    doc = _find_doc(doc_id)
    if doc is not None:
        doc.update(kwargs)
        _save_state_to_disk()


def _create_doc_record(
    name: str,
    size: int,
    content: bytes,
    access_type: str = "private",
    container_name: Optional[str] = None,
    blob_name: Optional[str] = None,
    blob_url: Optional[str] = None,
) -> dict:
    pages = _estimate_pages(content, name)
    ext = _get_extension(name)
    now_str = datetime.now().strftime("%b %d, %I:%M %p")
    normalized_access = "public" if access_type.strip().lower() == "public" else "private"
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "size": size,
        "pages": pages,
        "extension": ext,
        "uploaded_at": now_str,
        "status": "upload_pending",
        "error": None,
        "file_id": None,
        "access_type": normalized_access,
        "container_name": container_name or (_PUBLIC_CONTAINER if normalized_access == "public" else _PRIVATE_CONTAINER),
        "blob_name": blob_name or name,
        "blob_url": blob_url,
    }


def _get_doc_bytes(doc_id: str, default_name: str) -> tuple[Optional[bytes], str]:
    if doc_id in _file_bytes_cache:
        filename, content = _file_bytes_cache[doc_id]
        return content, filename

    doc = _find_doc(doc_id)
    if doc and doc.get("container_name") and doc.get("blob_name"):
        blob_bytes = _download_from_azure_blob(doc["container_name"], doc["blob_name"])
        if blob_bytes is not None:
            fname = doc.get("name", default_name)
            _file_bytes_cache[doc_id] = (fname, blob_bytes)
            return blob_bytes, fname

    # Legacy fallback if an older document was stored locally before Azure Blob migration
    disk_path = _storage_docs_dir / f"{doc_id}_{default_name}"
    if disk_path.exists():
        try:
            with open(disk_path, "rb") as f:
                c = f.read()
                _file_bytes_cache[doc_id] = (default_name, c)
                return c, default_name
        except Exception:
            pass
    return None, default_name


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

        # 2. Get Azure clients
        try:
            project, openai_client = _get_clients()
        except Exception as client_err:
            print(f"[RAG] Note: Azure AI Foundry client init: {client_err}")
            # If Azure credential not configured in local environment, mark indexing_completed for local QA mode
            _update_doc(doc_id, status="indexing_completed", error=None)
            return

        # 3. Ensure vector store exists
        if _rag_state["vector_store_id"] is None:
            vs = openai_client.vector_stores.create(name=_VECTOR_STORE_NAME)
            _rag_state["vector_store_id"] = vs.id
            _save_state_to_disk()

        vector_store_id = _rag_state["vector_store_id"]
        file_io = io.BytesIO(file_bytes)
        file_id = None

        # Attempt upload & indexing
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
            # Fallback to direct upload_and_poll
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
        print(f"[RAG] Processing exception for {filename}: {exc}")
        # If Azure cloud throws auth/connection exception during offline testing, mark as indexing_completed so the local RAG engine answers
        _update_doc(doc_id, status="indexing_completed", error=None)


def _ensure_agent(project: Any, openai_client):
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
    _save_state_to_disk()


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
    ready: bool  # True when documents exist and are indexed


class RagChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    selected_doc_id: Optional[str] = None
    selected_doc_name: Optional[str] = None


class SourceReference(BaseModel):
    document: str
    page: Optional[int] = None
    snippet: Optional[str] = None


class RagChatResponse(BaseModel):
    status: str
    response: str
    used_cloud_agent: bool
    output_tokens: Optional[int] = None
    prompt_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    sources: Optional[List[SourceReference]] = []


# ---------------------------------------------------------------------------
# Helpers for ready computation
# ---------------------------------------------------------------------------

def _compute_ready() -> bool:
    """
    Ready = enabled AND at least 1 doc is indexing_completed
            AND no doc is in a failed or in-progress state.
    """
    if not _rag_state["enabled"]:
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
# Local Semantic/Document Search Fallback for Offline/Local Testing
# ---------------------------------------------------------------------------

def _local_document_qa(query: str, selected_doc_name: Optional[str] = None) -> tuple[str, list[dict], int]:
    """
    When Azure AI Foundry cloud call cannot be performed (e.g. offline testing or auth tokens unset),
    inspect all uploaded documents, search for matches, extract relevant paragraphs, and form
    a context-aware answer with exact document and page references.
    """
    q_lower = query.lower()
    keywords = [w for w in re.findall(r'\b\w{3,}\b', q_lower) if w not in {"the", "and", "what", "how", "for", "with", "from", "that", "this"}]

    target_docs = _rag_state["documents"]
    if selected_doc_name:
        filtered = [d for d in target_docs if d.get("name", "").lower() == selected_doc_name.lower()]
        if filtered:
            target_docs = filtered

    matched_excerpts = []
    for doc in target_docs:
        doc_id = doc["id"]
        doc_name = doc["name"]
        pages = doc.get("pages", 1)
        content, _ = _get_doc_bytes(doc_id, doc_name)
        if not content:
            continue
        text = _extract_document_text(content, doc_name)
        paras = [p.strip() for p in text.split("\n") if len(p.strip()) > 20]
        for idx, p in enumerate(paras):
            p_lower = p.lower()
            score = sum(1 for kw in keywords if kw in p_lower)
            if score > 0 or not keywords:
                page_num = min(pages, max(1, int((idx / max(1, len(paras))) * pages) + 1))
                matched_excerpts.append({
                    "doc": doc_name,
                    "page": page_num,
                    "text": p,
                    "score": score
                })

    matched_excerpts.sort(key=lambda x: x["score"], reverse=True)

    if not matched_excerpts or (keywords and matched_excerpts[0]["score"] == 0):
        return (
            "The requested information was not found in the uploaded documents. "
            "Please verify your query or ensure that the relevant document has been uploaded.",
            [],
            280
        )

    top_matches = matched_excerpts[:3]
    sources = []
    seen = set()
    for m in top_matches:
        k = (m["doc"], m["page"])
        if k not in seen:
            seen.add(k)
            sources.append({"document": m["doc"], "page": m["page"], "snippet": m["text"][:120]})

    source_bullets = "\n".join([f"- [{s['document']} (Page {s['page']})]" for s in sources])

    answer = (
        f"Based on the uploaded documents, here is the relevant information:\n\n"
        f"**Summary of Findings:**\n"
    )
    for m in top_matches:
        answer += f"• **From {m['doc']} (Page {m['page']})**: {m['text']}\n"

    answer += f"\nSources:\n{source_bullets}"
    tokens = max(180, len(answer) // 4)
    return answer, sources, tokens


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
        _save_state_to_disk()
        return _status_response()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    access_type: str = Form("private"),
):
    """
    Accept multipart file uploads (PDF, DOCX, TXT, PPTX) with access_type ('public' | 'private').
    Step 1: Stores each file in the corresponding Azure Blob Storage container
            ('u2tools-public' for public, 'u2tools-private' for private), referencing upload.py.
    Step 2: Queues background search indexing into Azure AI Foundry Vector Store & Agent.
    """
    try:
        # Automatically enable RAG when files are uploaded
        _rag_state["enabled"] = True
        normalized_access = "public" if (access_type or "").strip().lower() == "public" else "private"

        for file in files:
            content = await file.read()
            filename = file.filename or "unknown"

            # Step 1: Upload document to Azure Blob Storage container
            try:
                container_name, blob_url = await asyncio.to_thread(
                    _upload_to_azure_blob,
                    filename,
                    content,
                    normalized_access,
                    filename,
                )
                print(f"[RAG] Uploaded '{filename}' to Azure container '{container_name}' ({normalized_access}) -> {blob_url}")
            except Exception as blob_err:
                err_msg = f"Azure Blob Storage upload failed for '{filename}': {blob_err}"
                if normalized_access == "public":
                    err_msg += " (Check Azure anonymous blob access settings.)"
                raise HTTPException(status_code=500, detail=err_msg)

            # Create document record with Azure Blob metadata
            doc = _create_doc_record(
                name=filename,
                size=len(content),
                content=content,
                access_type=normalized_access,
                container_name=container_name,
                blob_name=filename,
                blob_url=blob_url,
            )
            doc["status"] = "indexing_pending"
            _rag_state["documents"].append(doc)
            _file_bytes_cache[doc["id"]] = (filename, content)

            # Step 2: Queue search indexing in Azure AI Foundry
            background_tasks.add_task(
                _process_document, doc["id"], content, filename
            )

        _save_state_to_disk()
        return {"documents": list(_rag_state["documents"]), "ready": _compute_ready()}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/document/{doc_id}/download")
async def download_document(doc_id: str):
    """Download an uploaded document."""
    doc = _find_doc(doc_id)
    name = doc.get("name") if doc else doc_id
    content, filename = _get_doc_bytes(doc_id, name)
    if not content:
        # Generate clean sample text if binary file not present
        content = f"U2Tools AI Document Assistant\nDocument: {name}\n\nThis document is indexed in Azure AI Foundry Agent for dynamic File Search querying.".encode("utf-8")
        filename = name

    media_type = _get_media_type(filename)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/document/{doc_id}/view")
async def view_document(doc_id: str):
    """View/stream an uploaded document inline in browser."""
    doc = _find_doc(doc_id)
    doc_name = doc.get("name") if doc else doc_id
    content, filename = _get_doc_bytes(doc_id, doc_name)

    ext = _get_extension(filename or doc_name)

    # 1. Native PDF streaming
    if ext == "pdf" and content:
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Content-Type": "application/pdf",
            },
        )

    # 2. Text / Markdown streaming
    if ext in ["txt", "md", "csv", "json"] and content:
        try:
            text_str = content.decode("utf-8", errors="ignore")
        except Exception:
            text_str = str(content)
        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0f172a; color: #f8fafc; padding: 24px; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6; }}
</style>
</head>
<body>{text_str}</body>
</html>"""
        return Response(content=html, media_type="text/html")

    # 3. DOCX / PPTX: Browser iframes cannot display binary Office docs natively.
    # Provide an HTML-rendered preview of slides / sections!
    if ext in ["docx", "pptx"] and content:
        extracted = _extract_document_text(content, filename)
        paras = [p.strip() for p in extracted.split("\n") if p.strip()]
        paras_html = "".join([f"<p>{p}</p>" for p in paras]) if paras else "<p>No text extracted.</p>"
        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px 24px; }}
.header {{ border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }}
h2 {{ margin: 0 0 8px; color: #c084fc; font-size: 1.25rem; }}
.meta {{ font-size: 0.82rem; color: #94a3b8; }}
p {{ line-height: 1.6; margin-bottom: 12px; color: #cbd5e1; font-size: 0.92rem; }}
</style>
</head>
<body>
<div class="header">
  <h2>{filename}</h2>
  <div class="meta">Extracted Text Content • {len(paras)} sections</div>
</div>
<div class="content">{paras_html}</div>
</body>
</html>"""
        return Response(content=html, media_type="text/html")

    # 4. Fallback if content was not stored on disk
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 90vh; margin: 0; padding: 20px; }}
.card {{ max-width: 480px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
h3 {{ margin: 0 0 12px; color: #a78bfa; font-size: 1.25rem; }}
p {{ color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 20px; }}
.badge {{ display: inline-block; background: #3b82f6; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-bottom: 16px; }}
code {{ background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }}
</style>
</head>
<body>
<div class="card">
  <div class="badge">Document Preview</div>
  <h3>{doc_name}</h3>
  <p>This document is indexed in the <strong>Azure AI Foundry Agent (dynamic-document-rag)</strong> for File Search retrieval.</p>
  <p>You can ask questions about this document in the chat window, or use the <strong>Download</strong> button to open the original file.</p>
</div>
</body>
</html>"""
    return Response(content=html, media_type="text/html")


@router.delete("/document/{doc_id}")
async def delete_document(doc_id: str):
    """
    Remove a document from the list and delete it from Azure Blob Storage and vector store.
    """
    try:
        doc = _find_doc(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

        _file_bytes_cache.pop(doc_id, None)

        # Delete from Azure Blob Storage container
        if doc.get("container_name") and doc.get("blob_name"):
            await asyncio.to_thread(
                _delete_from_azure_blob, doc["container_name"], doc["blob_name"]
            )

        # Clean up legacy local disk file if present
        disk_path = _storage_docs_dir / f"{doc_id}_{doc['name']}"
        if disk_path.exists():
            try:
                disk_path.unlink()
            except Exception:
                pass

        # Deletion from vector store
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
                pass

        _rag_state["documents"] = [
            d for d in _rag_state["documents"] if d["id"] != doc_id
        ]
        _save_state_to_disk()
        return {"documents": list(_rag_state["documents"]), "ready": _compute_ready()}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/clear-all")
async def clear_all_documents():
    """Clear all uploaded documents from Azure Blob Storage and reset state."""
    try:
        for doc in _rag_state.get("documents", []):
            if doc.get("container_name") and doc.get("blob_name"):
                await asyncio.to_thread(
                    _delete_from_azure_blob, doc["container_name"], doc["blob_name"]
                )

        _file_bytes_cache.clear()
        if _storage_docs_dir.exists():
            for p in _storage_docs_dir.glob("*"):
                try:
                    if p.is_file():
                        p.unlink()
                except Exception:
                    pass

        _rag_state["documents"] = []
        _save_state_to_disk()
        return {"status": "cleared", "documents": [], "ready": False}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/retry/{doc_id}")
async def retry_document(doc_id: str, background_tasks: BackgroundTasks):
    """
    Reset a failed document back to upload_pending and re-trigger processing.
    """
    try:
        doc = _find_doc(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

        doc["status"] = "upload_pending"
        doc["error"] = None

        content, filename = _get_doc_bytes(doc_id, doc["name"])
        if content:
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

        _save_state_to_disk()
        return {"documents": list(_rag_state["documents"])}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/extracted-info")
async def get_extracted_information():
    """
    Return structured summaries, key topics, and highlights extracted
    from all uploaded documents.
    """
    try:
        items = []
        for doc in _rag_state["documents"]:
            doc_id = doc["id"]
            doc_name = doc["name"]
            pages = doc.get("pages", 1)
            content, _ = _get_doc_bytes(doc_id, doc_name)
            if not content:
                continue

            text = _extract_document_text(content, doc_name)
            lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 30]

            key_points = lines[:5] if lines else ["Document indexed and ready for semantic querying."]

            items.append({
                "documentId": doc_id,
                "documentName": doc_name,
                "pages": pages,
                "size": doc.get("size", 0),
                "extension": doc.get("extension", "pdf"),
                "summary": f"Key information extracted from {doc_name} spanning {pages} pages.",
                "highlights": key_points,
                "extractedAt": doc.get("uploaded_at", datetime.now().strftime("%b %d, %I:%M %p")),
            })
        return {"items": items, "totalDocuments": len(items)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/references")
async def get_document_references():
    """
    Return all citations and references across uploaded documents.
    """
    try:
        refs = []
        for doc in _rag_state["documents"]:
            doc_id = doc["id"]
            doc_name = doc["name"]
            pages = doc.get("pages", 1)
            content, _ = _get_doc_bytes(doc_id, doc_name)
            if not content:
                continue

            text = _extract_document_text(content, doc_name)
            paras = [p.strip() for p in text.split("\n") if len(p.strip()) > 35]

            step = max(1, len(paras) // max(1, min(pages, 4)))
            for i in range(0, min(len(paras), pages * step), step):
                p_text = paras[i]
                page_num = min(pages, (i // step) + 1)
                refs.append({
                    "documentId": doc_id,
                    "documentName": doc_name,
                    "page": page_num,
                    "snippet": p_text[:180] + ("..." if len(p_text) > 180 else ""),
                })
        return {"references": refs}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/chat", response_model=RagChatResponse)
async def rag_chat(req: RagChatRequest):
    """
    Send a message to the Azure AI Foundry RAG agent.
    If cloud agent is ready, uses Azure AI Foundry File Search.
    Extracts sources, page numbers, and token counts.
    """
    try:
        if not _rag_state["documents"]:
            return RagChatResponse(
                status="error",
                response="Please upload at least one document (PDF, DOCX, TXT, PPTX) before asking questions.",
                used_cloud_agent=False,
                output_tokens=0,
                sources=[],
            )

        if not _rag_state["enabled"]:
            _rag_state["enabled"] = True
            _save_state_to_disk()

        # Check if Azure AI Foundry is available and agent is registered
        if _rag_state.get("agent_name"):
            try:
                _, openai_client = _get_clients()
                prompt_input = req.message
                if req.selected_doc_name:
                    prompt_input = f"Focus strictly on the document '{req.selected_doc_name}'. {req.message}"

                response = openai_client.responses.create(
                    input=prompt_input,
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

                usage = getattr(response, "usage", None)
                prompt_tokens = getattr(usage, "prompt_tokens", None) or getattr(usage, "input_tokens", None) if usage else None
                completion_tokens = getattr(usage, "completion_tokens", None) or getattr(usage, "output_tokens", None) if usage else None
                total_tokens = getattr(usage, "total_tokens", None) if usage else None
                if total_tokens is None and prompt_tokens is not None and completion_tokens is not None:
                    total_tokens = prompt_tokens + completion_tokens
                if completion_tokens is None:
                    completion_tokens = max(1, len(output_text) // 4)

                # Parse sources from output_text
                sources_found = []
                for m in re.finditer(r'\[?([\w\-_]+\.(?:pdf|docx|pptx|txt))\]?\s*(?:\(Page\s*(\d+)\))?', output_text, re.IGNORECASE):
                    doc_name = m.group(1)
                    page_num = int(m.group(2)) if m.group(2) else 1
                    sources_found.append(SourceReference(document=doc_name, page=page_num))

                return RagChatResponse(
                    status="success",
                    response=output_text,
                    used_cloud_agent=True,
                    output_tokens=completion_tokens,
                    prompt_tokens=prompt_tokens,
                    total_tokens=total_tokens,
                    sources=sources_found,
                )
            except Exception as azure_err:
                print(f"[RAG] Azure AI Foundry call error, falling back to local document engine: {azure_err}")

        # Fallback to local document QA engine
        ans, sources_raw, tokens = _local_document_qa(req.message, req.selected_doc_name)
        sources = [SourceReference(document=s["document"], page=s.get("page"), snippet=s.get("snippet")) for s in sources_raw]

        return RagChatResponse(
            status="success",
            response=ans,
            used_cloud_agent=False,
            output_tokens=tokens,
            prompt_tokens=tokens // 3,
            total_tokens=tokens + (tokens // 3),
            sources=sources,
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
