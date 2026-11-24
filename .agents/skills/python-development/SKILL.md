---
name: python-development
description: >-
  Guides Python 3.12+ backend, FastAPI, RAG, LangChain, and Azure AI
  development in backend/python_service/. Use when building or updating FastAPI
  endpoints, Pydantic models, SQLAlchemy/PostgreSQL access, Socket.IO handlers,
  OpenAI/LangChain workflows, or Azure Speech/Blob/AI Foundry integrations.
---

# Python Development

Builds async FastAPI services, RAG pipelines, and Azure AI integrations in `backend/python_service/` using Python 3.12+.

## When to Use

- Adding or modifying FastAPI routes, Pydantic schemas, or Socket.IO events in `backend/python_service/`.
- Building or refining RAG pipelines (`standup_note/`, `CH-3_Agent/`), OpenAI/LangChain chains, or Azure AI / Speech / Blob Storage services.
- Working with SQLAlchemy 2.0, Psycopg 3, JWT authentication, or background Python utilities.

## Technical Guidelines

- **Runtime & Packaging**: Python `>=3.12`, managed via `uv` (`pyproject.toml`, `uv.lock`) and `requirements.txt`.
- **Web Stack**: FastAPI, Uvicorn, `pydantic-settings`, `httpx`, `python-socketio`.
- **AI & Cloud**: `openai`, `langchain`, `langchain-openai`, `langchain-azure-ai`, `azure-ai-projects`, `azure-identity`, `azure-cognitiveservices-speech`, `azure-storage-blob`.
- **Persistence & Auth**: `sqlalchemy` 2.0, `psycopg[binary]` 3, `PyJWT`, `passlib[bcrypt]`.

## Coding Standards

- Follow PEP 8 with full type annotations on function signatures, return values, and Pydantic models.
- Use `pydantic-settings` / `python-dotenv` to load configuration from `.env`; document every required variable in `.env.example`.
- Use explicit `HTTPException` responses with structured error details; never leak raw stack traces or API keys to clients.
- Separate route handlers (HTTP layer) from domain/AI service modules (`CH-2_Services/`, `standup_note/`, `utilities/`).

## Step-by-Step Implementation Approach

1. Inspect existing modules (`standup_note/ai_assistent.py`, `rag_service.py`, `CH-2_Services/`, `CH-3_Agent/`, `pyproject.toml`, `requirements.txt`) to reuse existing clients and config.
2. Define Pydantic v2 request/response models with field validation and constraints.
3. Implement service logic with proper timeouts, structured logging, and error handling for external AI/Azure calls.
4. Expose FastAPI routes with clear `response_model`, status codes, and dependency injection (`Depends`).
5. Update `.env.example` (never `.env`) if new configuration variables are introduced.

## Best Practices

- Use `async def` with `httpx.AsyncClient` for I/O-bound endpoints; offload blocking CPU/SDK calls with `asyncio.to_thread()` or `def` endpoints.
- Prefer `DefaultAzureCredential` / managed identity patterns over static keys where Azure Identity is used.
- Bound RAG chunk sizes, retrieval top-k, and LLM `max_tokens` to keep latency and cost predictable.
- Keep `requirements.txt` and `pyproject.toml` synchronized when adding dependencies.

## Common Mistakes to Avoid

- Calling synchronous `requests` or blocking SDK calls inside `async def` FastAPI routes.
- Hardcoding OpenAI/Azure API keys, endpoints, or storage SAS tokens in source code.
- Ignoring empty/malformed LLM outputs or missing error handling on rate limits (`429`) and timeouts.
- Committing `.env`, `__pycache__/`, or local `.venv/` artifacts.

## Testing and Validation

1. Run `pytest` inside `backend/python_service/` using the project's virtual environment.
2. Mock external OpenAI, Azure AI, Speech, and Blob calls in unit tests for deterministic execution.
3. Verify FastAPI app import and `/docs` OpenAPI schema generation cleanly without startup errors.
