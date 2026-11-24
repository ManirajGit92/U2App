---
trigger: always_on
---

# U2App Coding Standards

Follow these workspace-wide coding standards across all technologies in U2App:

## General Rules

- Inspect existing code, architecture, and installed framework versions before making edits.
- Reuse existing components, services, DTOs, validators, and utilities instead of duplicating logic.
- Follow `.editorconfig` (UTF-8, 2-space indentation, final newline, trim trailing whitespace).
- Write clean, readable, SOLID code with explicit error handling; never suppress errors silently.
- Avoid introducing new dependencies unless strictly necessary and justified.
- Preserve existing functionality and run relevant builds/tests after every implementation.

## Angular / TypeScript (`frontend/`)

- Target **Angular 21.2** standalone components, modern control flow (`@if`, `@for` with `track`, `@switch`), Signals, and **TypeScript 5.9** strict mode (`strict`, `strictTemplates`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`).
- Format with `.prettierrc` (`printWidth: 100`, `singleQuote: true`, Angular HTML parser).
- Avoid `any`; type all HTTP requests, component inputs/outputs, and state models.
- Clean up all RxJS subscriptions using `async` pipe, `toSignal()`, or `takeUntilDestroyed()`.
- Use `app` selector prefix and SCSS (`inlineStyleLanguage: "scss"`).

## .NET / C# (`backend/dotnet_service/U2Tools.Api/`)

- Target **.NET 10 (`net10.0`)** with `Nullable: enable` and `ImplicitUsings: enable`.
- Use `async`/`await` with `CancellationToken` for all I/O and database calls; never block with `.Result` or `.Wait()`.
- Keep controllers thin; place business logic in `Services/`, contracts in `DTOs/`, and validation in `Validators/`.
- Use structured Serilog logging templates without string interpolation or sensitive data.

## Python (`backend/python_service/`)

- Target **Python 3.12+** with PEP 8 formatting and full type annotations.
- Use Pydantic v2 models for request/response validation and `pydantic-settings` / `.env` for configuration.
- Use `async def` with non-blocking I/O (`httpx.AsyncClient`) in FastAPI routes; offload blocking calls with `asyncio.to_thread()`.
- Keep `pyproject.toml` and `requirements.txt` aligned when dependencies change.
