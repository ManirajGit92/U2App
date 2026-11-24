---
trigger: always_on
---

# U2App Security Rules

## Secrets & Credentials

- **NEVER** hardcode API keys, OpenAI/Azure keys, JWT secrets, Firebase private keys, Supabase service-role keys, or database passwords in source files, tests, or documentation.
- Load secrets exclusively from environment variables, `.env` (gitignored; document keys in `.env.example`), or .NET User Secrets.
- Never commit `.env` files or log credentials, bearer tokens, or PII in Serilog, Python logs, or browser console output.

## Authentication, Authorization & Access Control

- Enforce authentication and authorization on the server (`.NET` `[Authorize]`, `FastAPI` auth dependencies, `frontend/firestore.rules`, Supabase RLS). Angular route guards are UX controls only, not security boundaries.
- Never trust client-supplied user IDs, roles, permissions, or billing amounts without server-side validation.

## Input Validation & Injection Defense

- Validate and constrain all external inputs using Pydantic v2 models, .NET `Validators/`, and Angular Reactive Forms.
- Use parameterized queries exclusively (EF Core LINQ, SQLAlchemy bound parameters, parameterized T-SQL/PL/pgSQL). Never concatenate untrusted strings into SQL, shell commands, or file paths.
- Sanitize or avoid raw HTML injection (`innerHTML`, `bypassSecurityTrustHtml`) to prevent XSS.
- Enforce file size, MIME/extension allowlists, and safe path resolution for all document/image/PDF uploads (including RAG ingestion).

## Deployment & Destructive Change Safety

- Configure explicit CORS allowlists per environment; never combine wildcard origins with credentials.
- **Ask for explicit user approval** before any production deployment, infrastructure change, or destructive database/file operation.
