---
name: api-integration
description: >-
  Guides REST API and WebSocket contract design and cross-stack integration
  between Angular 21, .NET 10 Web API, Python FastAPI, and external services in
  U2App. Use when wiring frontend services to backend endpoints, updating
  proxy.conf.json, aligning DTOs, or configuring CORS and error handling.
---

# API Integration

Ensures consistent, strongly typed, and resilient communication across U2App's Angular frontend, .NET Web API, Python FastAPI service, and third-party APIs.

## When to Use

- Connecting an Angular feature service to a `.NET 10` (`/api/*`) or `Python FastAPI` (`/api/rag`, `/api/voice`, `/api/tanglish`) endpoint.
- Designing new REST endpoints, Socket.IO events, request/response DTOs, or error contracts.
- Updating `frontend/proxy.conf.json`, CORS policies, authentication headers, or deployment routing (`netlify.toml`, `vercel.json`).

## Technical Guidelines

- **Local Routing (`frontend/proxy.conf.json`)**:
  - `/api/rag`, `/api/voice`, `/api/tanglish` -> Python FastAPI (`http://127.0.0.1:8000`)
  - `/api/standup-ai` -> `https://u2tools.onrender.com`
  - `/api` -> .NET Web API (`http://127.0.0.1:5000`)
- **Contract Parity**: Match JSON property casing (`camelCase` standard for JSON APIs), optionality, enum values, and ISO-8601 UTC date strings across TypeScript interfaces, C# DTOs, and Pydantic models.
- **Error Envelopes**: Standardize error responses (`ProblemDetails` in .NET, structured JSON detail in FastAPI) and map them cleanly in Angular services/interceptors.

## Coding Standards

- Use plural, kebab-case resource nouns in URLs (`/api/work-items/{id}`), never verbs unless modeling an RPC action (e.g., `/api/rag/query`).
- Type every `HttpClient` call (`this.http.post<ResponseDto>(...)`) — never leave responses as `Observable<any>` or `Observable<Object>`.
- Propagate auth tokens via Angular HTTP interceptors rather than manually attaching headers in every component.

## Step-by-Step Implementation Approach

1. Inspect existing routes in `frontend/proxy.conf.json`, backend controllers/routers, and Angular services.
2. Define the API contract first: HTTP method, URL, path/query params, request/response JSON schemas, and error status codes.
3. Implement or update the backend endpoint and verify its OpenAPI/Swagger schema.
4. Create or update the matching TypeScript interfaces and Angular service methods with timeout/error handling.
5. Update `proxy.conf.json` and environment configs if new route prefixes are introduced, without breaking existing routes.

## Best Practices

- Keep changes backward-compatible (additive fields) when existing frontend views depend on an endpoint.
- Use `HttpParams` instead of manual query string concatenation.
- Handle network timeouts, `401`/`403` auth expiry, `422` validation errors, and `5xx` server errors with user-friendly messages.
- Validate CORS origins explicitly per environment; avoid wildcard `*` with credentials.

## Common Mistakes to Avoid

- Mismatched casing (`snake_case` from Python vs `camelCase` expected by Angular) without Pydantic `alias_generator` or explicit mapping.
- Ordering broad proxy rules (`/api`) before specific rules (`/api/rag`, `/api/voice`) in `proxy.conf.json`.
- Hardcoding production URLs or API keys inside Angular services.
- Silently swallowing HTTP errors in `catchError` without surfacing feedback or logging.

## Testing and Validation

1. Verify OpenAPI/Swagger definitions on `.NET` and `FastAPI` match Angular TypeScript models.
2. Run `npm run build` in `frontend/`, `dotnet build` in `backend/dotnet_service/`, and `pytest` in `backend/python_service/` as applicable.
3. Test the integrated request flow end-to-end with `HttpTestingController` or local dev servers.
