---
name: unit-testing
description: >-
  Guides unit, integration, and E2E testing across U2App using Vitest/Jasmine/
  Jest for Angular 21, Playwright for E2E, Pytest for Python/FastAPI, and xUnit
  for .NET 10. Use when writing, fixing, or expanding automated tests.
---

# Unit Testing

Creates fast, deterministic, behavior-focused automated tests across Angular, .NET, Python, and E2E browser flows.

## When to Use

- Adding unit or integration tests for new features, services, controllers, FastAPI routes, or utilities.
- Writing regression tests to lock in a bug fix.
- Setting up or expanding E2E test coverage with Playwright.

## Technical Guidelines

- **Angular (`frontend/`)**: Angular 21 defaults to Vitest via `ng test` (`npm test`); support Jasmine/Jest syntax where configured. Use `TestBed`, `HttpTestingController`, and mock providers for Firebase/Supabase/Socket.IO.
- **Python (`backend/python_service/`)**: `pytest` 8.4 with `fastapi.testclient.TestClient` / `httpx.AsyncClient`, fixtures, and `monkeypatch`/`unittest.mock` for OpenAI and Azure SDKs.
- **.NET (`backend/dotnet_service/`)**: xUnit with `WebApplicationFactory<Program>`, mocked service interfaces, and isolated test databases.
- **E2E**: Playwright with role/label/testid locators and deterministic network/UI assertions.

## Coding Standards

- Structure every test with clear **Arrange-Act-Assert (AAA)** sections.
- Name tests by behavior and expected outcome (e.g., `should_return_400_when_payload_is_empty` or `returns filtered items when query matches`).
- Keep tests independent: never rely on execution order or shared mutable state across tests.

## Step-by-Step Implementation Approach

1. Inspect existing test configuration (`frontend/angular.json`, `frontend/tsconfig.spec.json`, `backend/python_service/requirements.txt`, `.csproj`).
2. Identify the public contract and edge cases: happy path, empty/null inputs, boundary values, validation errors, auth failures, and downstream errors.
3. Mock external boundaries (HTTP, databases, OpenAI/Azure AI, Firebase/Supabase, system clock) while testing real domain logic.
4. Write concise, readable tests and run the suite to verify every test passes reliably.
5. Verify test failure sensitivity (ensure assertions actually catch broken behavior).

## Best Practices

- Test observable behavior and outputs rather than private implementation details.
- Use factory/builder helpers for test fixtures to reduce boilerplate.
- Keep unit tests fast (milliseconds) so developers run them continuously.

## Common Mistakes to Avoid

- Calling live OpenAI, Azure, Firebase, or production database endpoints from unit tests.
- Using arbitrary `sleep` / `waitForTimeout` calls in async or Playwright tests.
- Writing tautological assertions that mirror implementation mocks without verifying real logic.

## Testing and Validation

1. Run `npm test` in `frontend/` for Angular tests.
2. Run `pytest` in `backend/python_service/` for Python tests.
3. Run `dotnet test` in `backend/dotnet_service/` for .NET tests.
4. Report exact pass/fail/skip counts and any environment prerequisites.
