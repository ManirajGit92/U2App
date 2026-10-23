import os
import sys
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env if present
current_dir = Path(__file__).resolve().parent
python_service_dir = current_dir.parent
env_candidates = [
    python_service_dir / ".env",
    current_dir / ".env",
]
for env_file in env_candidates:
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
load_dotenv()

# Backend defaults referencing CH-1_Models/1_LLM.py and .env
DEFAULT_API_KEY = os.environ.get("API_KEY2")
DEFAULT_ENDPOINT = os.environ.get("LLM_ENDPOINT2")
DEFAULT_DEPLOYMENT = os.environ.get("DEPLOYMENT_NAME")

BACKEND_API_KEY = os.environ.get("API_KEY") or DEFAULT_API_KEY
BACKEND_ENDPOINT = os.environ.get("LLM_ENDPOINT") or DEFAULT_ENDPOINT
BACKEND_DEPLOYMENT = os.environ.get("DEPLOYMENT_NAME") or DEFAULT_DEPLOYMENT

app = FastAPI(title="U2Tools Standup AI API")

# Allow Angular and other web clients to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "https://u2tools.web.app",
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MessageItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageItem]] = []
    system_instructions: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None


class ChatResponse(BaseModel):
    status: str
    response: str
    model: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


def call_foundry_model(
    message: str,
    history: Optional[List[MessageItem]] = None,
    system_instructions: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
):
    """
    Calls the Azure AI Foundry model using client.responses.create
    similar to CH-1_Models/1_LLM.py.
    Uses the frontend-provided API key if given, otherwise falls back to the backend API key.
    """
    selected_api_key = api_key if (api_key and api_key.strip()) else BACKEND_API_KEY
    selected_endpoint = endpoint if (endpoint and endpoint.strip()) else BACKEND_ENDPOINT
    selected_model = model if (model and model.strip()) else BACKEND_DEPLOYMENT

    if not selected_api_key:
        raise ValueError("API key is not configured in backend or request.")

    # Initialize client referencing 1_LLM.py
    client = OpenAI(
        base_url=selected_endpoint,
        api_key=selected_api_key,
    )

    input_messages = []
    if system_instructions and system_instructions.strip():
        input_messages.append({"role": "system", "content": system_instructions.strip()})

    if history:
        for h in history:
            input_messages.append({"role": h.role, "content": h.content})

    input_messages.append({"role": "user", "content": message})

    # Call responses.create as in 1_LLM.py
    response = client.responses.create(
        model=selected_model,
        input=input_messages,
    )

    output_text = getattr(response, "output_text", None)
    if not output_text and hasattr(response, "output") and response.output:
        output_text = str(response.output[0])
    if not output_text:
        output_text = str(response)

    prompt_tokens = None
    completion_tokens = None
    total_tokens = None

    usage = getattr(response, "usage", None)
    if usage:
        prompt_tokens = getattr(usage, "prompt_tokens", None) or getattr(usage, "input_tokens", None)
        completion_tokens = getattr(usage, "completion_tokens", None) or getattr(usage, "output_tokens", None)
        total_tokens = getattr(usage, "total_tokens", None)
        if total_tokens is None and prompt_tokens is not None and completion_tokens is not None:
            total_tokens = prompt_tokens + completion_tokens

    return output_text, prompt_tokens, completion_tokens, total_tokens


@app.get("/")
def home():
    return {"message": "U2Tools Standup AI API is running"}


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "standup_note_ai_assistant"}


@app.get("/api/hello")
def hello():
    return {
        "message": "Hello from Python FastAPI Standup AI!",
        "status": "success",
        "technology": "Python",
    }


@app.post("/api/standup-ai/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
@app.post("/chat", response_model=ChatResponse)
def handle_chat(req: ChatRequest):
    try:
        response_text, prompt_tokens, completion_tokens, total_tokens = call_foundry_model(
            message=req.message,
            history=req.history,
            system_instructions=req.system_instructions,
            model=req.model,
            api_key=req.api_key,
            endpoint=req.endpoint,
        )
        return ChatResponse(
            status="success",
            response=response_text,
            model=req.model or BACKEND_DEPLOYMENT,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# cd d:\Projects\MainProjects\U2App\backend\python_service

#.\.venv\Scripts\uvicorn standup_note.ai_assistent:app --host 0.0.0.0 --port 8000 --reload
