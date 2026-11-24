---
name: dotnet-development
description: >-
  Guides C# and ASP.NET Core Web API development on .NET 10 in
  backend/dotnet_service/U2Tools.Api/. Use when creating or modifying
  controllers, services, DTOs, validators, middleware, EF Core 10 repositories
  or DbContext configurations, and Serilog/OpenAPI integrations.
---

# .NET Development

Builds clean, maintainable ASP.NET Core Web API endpoints and backend services on `.NET 10` (`net10.0`) with Entity Framework Core 10 and Serilog.

## When to Use

- Adding or updating REST controllers, services, DTOs, validators, or middleware in `backend/dotnet_service/U2Tools.Api/`.
- Configuring `U2ToolsDbContext`, EF Core 10 SQL Server mappings, or dependency injection in `Program.cs`.
- Improving authentication, error handling, OpenAPI/Swagger documentation, or structured logging.

## Technical Guidelines

- **Runtime & Packages**: `net10.0`, `Nullable: enable`, `ImplicitUsings: enable`, `Microsoft.EntityFrameworkCore.SqlServer` `10.0.13`, `Serilog.AspNetCore` `10.0.0`, `Swashbuckle.AspNetCore` `10.3.1`.
- **Layering**: Place HTTP endpoints in `Controllers/`, contracts in `DTOs/`, business logic in `Services/`, validation in `Validators/`, cross-cutting concerns in `Middleware/`, persistence in `Data/` & `Models/`, auth in `Authentication/`.
- **Async Everywhere**: Use `async`/`await` with `CancellationToken` parameters on all controller actions, service methods, and EF Core queries.

## Coding Standards

- Follow standard C# naming conventions (`PascalCase` for types/methods/properties, `_camelCase` for private fields, `Async` suffix for async methods).
- Resolve nullable reference warnings cleanly; never silence warnings with `!` without an invariant guarantee.
- Return `ActionResult<TDto>` or typed results with accurate HTTP status codes (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`).
- Use structured Serilog logging templates (`_logger.LogInformation("Created item {ItemId}", id)`) instead of string interpolation.

## Step-by-Step Implementation Approach

1. Inspect `Program.cs`, `U2ToolsDbContext`, and existing folders (`Controllers/`, `Services/`, `DTOs/`, `Validators/`) to match project conventions.
2. Define request/response DTOs and input validation rules before writing endpoint logic.
3. Implement service interfaces and concrete services registered in `Program.cs` with appropriate DI lifetimes (`Scoped`, `Transient`, `Singleton`).
4. Implement thin controllers that validate inputs, invoke services, and map results to HTTP responses.
5. Verify Swagger/OpenAPI documentation accurately reflects routes, payloads, and status codes.

## Best Practices

- Use `AsNoTracking()` for read-only EF Core queries and project directly into DTOs with `.Select(...)`.
- Handle unhandled exceptions centrally in middleware using RFC 7807 `ProblemDetails`.
- Never return EF Core entity classes directly from API endpoints.
- Keep secrets in User Secrets or environment variables, never in `appsettings.json`.

## Common Mistakes to Avoid

- Injecting a `Scoped` service (such as `U2ToolsDbContext`) into a `Singleton` service.
- Blocking async threads with `.Result` or `.Wait()`.
- Loading entire tables into memory with `.ToListAsync()` before filtering.
- Logging sensitive user data, passwords, tokens, or connection strings.

## Testing and Validation

1. Run `dotnet build` in `backend/dotnet_service/` and confirm zero errors and clean warnings.
2. Run `dotnet test` in `backend/dotnet_service/` when test projects are present.
3. Smoke-test endpoints via `U2Tools.Api.http` or Swagger UI in Development mode.
