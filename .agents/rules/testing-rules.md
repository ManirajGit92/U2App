---
trigger: model_decision
description: >-
  Apply when writing, modifying, or running unit, integration, or E2E tests,
  or when verifying implementations across Angular (Vitest/Jasmine/Jest),
  Playwright, Python (Pytest), and .NET (xUnit).
---

# U2App Testing Rules

## Test Runners by Layer

- **Angular Frontend (`frontend/`)**: `npm test` (Angular 21 `ng test` / Vitest) and `npm run build` for strict compilation verification.
- **Python Service (`backend/python_service/`)**: `pytest` (`pytest==8.4.1`) with FastAPI `TestClient` / `httpx`.
- **.NET Service (`backend/dotnet_service/`)**: `dotnet build` and `dotnet test` (xUnit / `WebApplicationFactory`).
- **E2E**: Playwright using accessible locators (`getByRole`, `getByLabel`, `getByTestId`).

## Mandatory Testing Standards

- Follow the **Arrange-Act-Assert (AAA)** structure with clear, behavior-oriented test names.
- Every bug fix should include a regression test whenever practical.
- Cover happy paths, boundary/empty inputs, validation errors, authorization failures, and downstream failure modes.
- Keep unit tests fast and deterministic: mock external network calls (OpenAI, Azure AI, Speech, Blob Storage, Firebase, Supabase) and never hit live production APIs or databases in unit tests.
- Never use arbitrary fixed sleeps (`sleep`, `waitForTimeout`) in async or E2E tests; await deterministic conditions.
- Run relevant builds and tests after implementation and report exact results.
