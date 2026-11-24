---
name: database-development
description: >-
  Guides SQL Server (EF Core 10) and PostgreSQL (SQLAlchemy 2 / Psycopg 3 /
  Supabase) database design, migrations, stored procedures, indexing, and query
  optimization in U2App. Use when modifying schemas, writing SQL/LINQ/ORM
  queries, creating migrations, or tuning database performance.
---

# Database Development

Designs reliable schemas, safe migrations, stored procedures, and high-performance queries across SQL Server and PostgreSQL/Supabase.

## When to Use

- Adding or altering tables, columns, constraints, indexes, views, or stored procedures.
- Creating or reviewing EF Core 10 migrations (`backend/dotnet_service/U2Tools.Api/Data/`) or SQLAlchemy 2.0 models (`backend/python_service/`).
- Investigating slow queries, deadlocks, N+1 ORM patterns, or Supabase Row-Level Security (RLS) policies.

## Technical Guidelines

- **SQL Server (.NET)**: EF Core 10 (`U2ToolsDbContext`), Fluent API configurations, T-SQL stored procedures, clustered/non-clustered/filtered indexes.
- **PostgreSQL (Python / Supabase)**: SQLAlchemy 2.0 + `psycopg` 3, PL/pgSQL, JSONB with GIN indexes, RLS policies on Supabase tables.
- **Safety First**: Treat every schema change as production-impacting; design additive, backward-compatible migrations.

## Coding Standards

- Use consistent naming conventions: `PascalCase` in SQL Server/EF Core (matching existing entities) and `snake_case` in PostgreSQL/SQLAlchemy.
- Always specify explicit column lists in `SELECT` statements; never use `SELECT *` in application queries.
- Parameterize every query (`@param` in T-SQL, `$1` / `:param` in PostgreSQL/SQLAlchemy); never concatenate user input into SQL strings.
- Include primary keys, foreign keys, `NOT NULL` constraints, and UTC timestamps (`CreatedAtUtc` / `created_at`).

## Step-by-Step Implementation Approach

1. Inspect existing entity models, DbContext/SQLAlchemy mappings, and recent migrations before changing schemas.
2. Design the schema change with constraints, indexes for common `WHERE`/`JOIN`/`ORDER BY` predicates, and a rollback plan.
3. Implement ORM mappings or SQL scripts and generate migrations without executing destructive changes automatically.
4. Review generated SQL / execution plans (`EXPLAIN (ANALYZE, BUFFERS)` for PostgreSQL, Actual Execution Plan for SQL Server).
5. Verify dependent backend services build and pass tests against the updated models.

## Best Practices

- Prefer keyset (cursor) pagination over deep `OFFSET/FETCH` for large tables.
- Use `AsNoTracking()` in EF Core and `selectinload`/`joinedload` in SQLAlchemy to avoid unnecessary tracking and N+1 queries.
- Keep transactions short and avoid external HTTP/AI calls while holding database locks.
- Enable and test Row-Level Security (RLS) policies for any client-accessible Supabase table.

## Common Mistakes to Avoid

- Running `DROP TABLE`, `TRUNCATE`, or irreversible column drops without explicit user approval.
- Writing non-sargable `WHERE` clauses (e.g., wrapping indexed columns in functions like `YEAR(CreatedAt) = 2026`).
- Missing indexes on foreign keys or high-selectivity filter columns.
- Hardcoding connection strings or database passwords in scripts or config files.

## Testing and Validation

1. Validate migration scripts in a non-production/local environment or via dry-run SQL generation (`dotnet ef migrations script`).
2. Run affected backend builds and tests (`dotnet build`, `pytest`).
3. Confirm query plans use index seeks/scans appropriately with no unintended full table scans on large tables.
