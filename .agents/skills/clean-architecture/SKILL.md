---
name: clean-architecture
description: >-
  Guides architectural design, layering, SOLID principles, and modularity
  across Angular 21, .NET 10, and Python FastAPI in U2App. Use when designing
  new features, refactoring tightly coupled code, establishing module
  boundaries, or planning cross-service changes.
---

# Clean Architecture

Enforces clear separation of concerns, SOLID principles, and maintainable module boundaries across U2App's frontend and backend services.

## When to Use

- Designing a new multi-layer feature spanning Angular, .NET, Python, and databases.
- Refactoring large "god components", fat controllers, or tightly coupled utility scripts.
- Evaluating whether to introduce a new service, shared module, or third-party dependency.

## Technical Guidelines

- **Dependency Rule**: High-level business logic must not depend directly on low-level infrastructure details (HTTP transport, concrete DB drivers, UI widgets).
- **Frontend Boundaries (`frontend/`)**: Presentational components -> feature container components -> feature services/state -> HTTP/Firebase/Supabase adapters.
- **.NET Boundaries (`backend/dotnet_service/U2Tools.Api/`)**: `Controllers/` (HTTP) -> `Services/` (business rules) -> `Data/` & `Models/` (persistence), with `DTOs/` and `Validators/` at the API boundary.
- **Python Boundaries (`backend/python_service/`)**: FastAPI routers (HTTP) -> domain/AI services -> repository/external SDK adapters (SQLAlchemy, Azure AI, OpenAI).

## Coding Standards

- Apply SOLID principles pragmatically (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion).
- Favor composition over inheritance and small, cohesive functions over deeply nested monoliths.
- Keep abstractions earned: avoid creating empty wrapper interfaces or repositories that add indirection without value.

## Step-by-Step Implementation Approach

1. Inspect the existing module layout and identify natural domain boundaries and reusable utilities.
2. Define explicit contracts (interfaces, DTOs, Pydantic schemas) between layers before writing implementation code.
3. Isolate external I/O (databases, LLM APIs, Firebase, Supabase, file system) behind dedicated services/adapters.
4. Keep UI components and HTTP controllers thin, delegating business decisions to testable domain services.
5. Review dependencies to ensure no circular references or unnecessary packages were introduced.

## Best Practices

- Co-locate feature files (components, models, services, tests) so features are easy to navigate and delete.
- Centralize cross-cutting concerns (logging, exception handling, auth, validation) in middleware/interceptors/dependencies.
- Prefer explicit configuration objects (`IOptions<T>`, `pydantic-settings`, Angular `environment`) over scattered `process.env`/`os.getenv` calls.

## Common Mistakes to Avoid

- Putting SQL/EF Core queries directly inside ASP.NET Core controllers or FastAPI route handlers.
- Embedding complex business calculations or raw HTTP calls inside Angular UI components.
- Over-engineering small utilities with excessive layers or boilerplate patterns.
- Introducing circular imports between shared and feature modules.

## Testing and Validation

1. Confirm business logic can be unit-tested without spinning up a browser, database, or live LLM API.
2. Run builds across all touched services (`npm run build`, `dotnet build`, `pytest`) to verify clean compilation and dependency boundaries.
