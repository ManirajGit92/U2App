---
name: debugging
description: >-
  Guides systematic root-cause analysis and bug fixing across Angular 21, .NET
  10, Python FastAPI, SQL Server, and PostgreSQL in U2App. Use when diagnosing
  build failures, runtime exceptions, RxJS/async issues, CORS/proxy errors, or
  unexpected behavior.
---

# Debugging

Provides a repeatable, evidence-driven root-cause analysis workflow for resolving defects across U2App's frontend, backend, and database layers.

## When to Use

- Investigating TypeScript/Angular compilation errors, runtime console exceptions, or UI state bugs.
- Troubleshooting HTTP `4xx`/`5xx`, CORS, proxy routing (`frontend/proxy.conf.json`), or Socket.IO disconnections.
- Diagnosing .NET 10 / EF Core exceptions, Serilog traces, or Python FastAPI / Azure AI / SQLAlchemy failures.

## Technical Guidelines

- Always reproduce the failure first and capture exact stack traces, HTTP payloads, status codes, and environment context.
- Trace across layer boundaries in order: UI/Component -> Angular Service -> Proxy/Network -> Backend Controller/Router -> Domain Service -> Database/External API.
- Check recent `git diff` and dependency/config changes before assuming deep framework bugs.

## Coding Standards

- Fix root causes rather than masking symptoms with empty `catch` blocks, `as any`, `!` assertions, or arbitrary `setTimeout` delays.
- Remove temporary debug `console.log` / `print` statements before finalizing; keep structured logging where diagnostics are genuinely needed.

## Step-by-Step Implementation Approach

1. **Reproduce**: Run the failing build, test, or request and record the exact error message and stack trace.
2. **Isolate**: Narrow down the failing file, function, and inputs by reading the full relevant code path.
3. **Hypothesize**: Form a specific hypothesis explaining *why* the error occurs and verify it with targeted inspection or logs.
4. **Fix Minimally**: Apply the smallest clean change that resolves the root cause without breaking adjacent behavior.
5. **Verify & Guard**: Re-run the reproduction steps, add a regression test when feasible, and execute the full relevant build/test suite.

## Best Practices

- Check Angular `proxy.conf.json` rule ordering and target ports (`:8000` Python, `:5000` .NET) when API calls hit the wrong backend or return HTML `index.html`.
- Inspect FastAPI `422 Unprocessable Entity` payloads for exact Pydantic field validation mismatches.
- Check .NET DI lifetimes and EF Core change tracking (`AsNoTracking` vs tracked updates) on unexpected state errors.

## Common Mistakes to Avoid

- Applying speculative fixes before reading the full stack trace and surrounding code.
- Disabling strict compiler flags, CORS security, or SSL verification to "make it work".
- Leaving untracked debug files or temporary log statements behind.

## Testing and Validation

1. Confirm the original failure no longer reproduces.
2. Run affected builds and test suites (`npm run build` / `npm test` in `frontend/`, `dotnet build` / `dotnet test`, `pytest`).
3. Verify no regressions were introduced in related routes or endpoints.
