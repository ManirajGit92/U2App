# U2App

Multi-service utility and productivity platform featuring an **Angular 21** frontend, a **.NET 10** ASP.NET Core Web API backend, and a **Python 3.12+** FastAPI + Azure AI / RAG backend.

## Repository Structure

- `frontend/` — Angular 21.2 standalone application (TypeScript 5.9, PrimeNG 21, Angular Material 21, RxJS 7.8, Firebase, Supabase).
- `backend/dotnet_service/U2Tools.Api/` — .NET 10 Web API with Entity Framework Core 10 (SQL Server), Serilog, and Swagger/OpenAPI.
- `backend/python_service/` — Python 3.12+ FastAPI service with Uvicorn, SQLAlchemy 2 / PostgreSQL, OpenAI, LangChain RAG, and Azure AI/Speech/Blob integrations.
- `.agents/` — Source-controlled **Google Antigravity** AI development team configuration (custom agents, skills, and project rules).

## Google Antigravity Team Setup

This repository includes a shared `.agents/` workspace configuration tracked in Git so every developer gets the same AI agents, skills, and project rules automatically.

### What Is Included in `.agents/`

- **`.agents/agents/`** (9 specialized agents): `solution-architect` (coordinator), `angular-developer`, `dotnet-developer`, `python-developer`, `database-specialist`, `api-integration-specialist`, `code-reviewer`, `testing-specialist`, `debugging-specialist`.
- **`.agents/skills/`** (11 domain skills): `angular-development`, `dotnet-development`, `python-development`, `database-development`, `api-integration`, `clean-architecture`, `debugging`, `code-review`, `unit-testing`, `security-best-practices`, `performance-optimization`.
- **`.agents/rules/`** (5 project rules): `coding-standards.md`, `architecture-rules.md`, `security-rules.md`, `testing-rules.md`, `database-rules.md`.

### Setup Steps for New Developers

1. Clone this repository and open the root folder (`U2App`) in **Google Antigravity** (IDE, App, or `agy` CLI).
2. No manual copy to `~/.gemini/config/` is required — Antigravity automatically discovers `.agents/agents/`, `.agents/skills/`, and `.agents/rules/` from the workspace root.
3. Configure local secrets only in gitignored files (e.g., copy `backend/python_service/.env.example` to `.env`, and use .NET User Secrets for `U2Tools.Api`). Never commit secrets.
4. Keep `.agents/` tracked in Git; do not add `.agents/` to `.gitignore`.
