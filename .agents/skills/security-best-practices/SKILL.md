---
name: security-best-practices
description: >-
  Guides secure coding, authentication/authorization, secret management, input
  validation, and OWASP hardening across Angular 21, .NET 10, Python FastAPI,
  Firebase/Supabase, and SQL databases in U2App. Use when implementing auth,
  handling sensitive data, adding endpoints, or auditing security.
---

# Security Best Practices

Enforces defense-in-depth security controls across U2App's Angular frontend, .NET Web API, Python FastAPI/AI services, and databases.

## When to Use

- Implementing authentication, authorization, JWT handling, Firebase/Firestore rules, or Supabase RLS policies.
- Adding new API endpoints, file upload handlers, RAG document ingestion, or database queries.
- Performing security reviews or hardening configurations (`CORS`, headers, secrets, dependencies).

## Technical Guidelines

- **Secrets Management**: Never hardcode API keys, JWT signing keys, Azure keys, or database passwords. Use `.env` (gitignored) + `.env.example` in Python, User Secrets / environment variables in .NET, and public-only client config in Angular.
- **Auth & Access Control**: Enforce authentication and role/ownership checks on the server (`.NET` `[Authorize]`, `FastAPI` dependencies, `firestore.rules`, Supabase RLS)—never rely on Angular route guards alone.
- **Injection Prevention**: Parameterize all SQL (EF Core LINQ, SQLAlchemy bound params, parameterized stored procedures); avoid `innerHTML` / `bypassSecurityTrustHtml` unless sanitized; validate file uploads and paths against path traversal.
- **AI / RAG Security**: Treat retrieved documents and user prompts as untrusted input; enforce upload size/type limits and avoid leaking system prompts or cross-tenant RAG documents.

## Coding Standards

- Validate and bound all external inputs using Angular Reactive Forms, .NET `Validators/` + model validation, and Pydantic v2 constraints.
- Hash passwords with strong adaptive algorithms (`passlib[bcrypt]` or ASP.NET Core Identity PasswordHasher).
- Return generic error messages to clients while logging detailed diagnostics securely on the server without PII or credentials.

## Step-by-Step Implementation Approach

1. Identify trust boundaries, sensitive assets, and threat vectors (OWASP Top 10) for the feature.
2. Enforce server-side authentication, authorization, and strict input validation.
3. Configure least-privilege CORS origins, HTTPS redirection, and secure headers.
4. Verify no secrets, tokens, or PII appear in source code, git diff, or logs.
5. Add negative security tests (unauthorized access, invalid input, forbidden resource).

## Best Practices

- Restrict CORS to explicit allowed origins per environment; never combine `AllowAnyOrigin()` with `AllowCredentials()`.
- Keep `frontend/firestore.rules` and Supabase RLS policies deny-by-default.
- Run dependency audits (`npm audit`, `dotnet list package --vulnerable`, `pip-audit`/`uv`) periodically.

## Common Mistakes to Avoid

- Committing `.env`, `appsettings.Development.json` with live credentials, or service-account JSON keys.
- Trusting client-supplied user IDs, roles, or prices without server-side verification.
- Using `eval()`, raw HTML interpolation, or string-interpolated SQL (`FromSqlRaw` with `$""`).

## Testing and Validation

1. Verify unauthenticated and unauthorized requests receive `401` / `403` responses.
2. Scan modified files for hardcoded secrets, tokens, or sensitive connection strings.
3. Run builds and security-focused unit/integration tests across affected services.
