---
trigger: model_decision
description: >-
  Apply when designing database schemas, writing SQL/T-SQL/PL-pgSQL, creating
  EF Core 10 or SQLAlchemy 2 models and migrations, optimizing queries, or
  configuring Supabase/PostgreSQL RLS policies.
---

# U2App Database Rules

## Supported Database Engines

- **SQL Server**: Accessed via EF Core 10 (`U2ToolsDbContext`) in `backend/dotnet_service/U2Tools.Api/Data/`.
- **PostgreSQL / Supabase**: Accessed via SQLAlchemy 2.0 + `psycopg` 3 in `backend/python_service/` and `@supabase/supabase-js` in `frontend/`.

## Mandatory Safety & Design Rules

- **NEVER** execute destructive database operations (`DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, irreversible column drops, or unscoped `DELETE`/`UPDATE`) without explicit user approval.
- Design additive, backward-compatible migrations with a clear rollback strategy.
- Always use parameterized queries; never concatenate user input into SQL strings or dynamic stored procedures.
- Avoid `SELECT *` in application code; select only required columns and project into DTOs.
- Use `AsNoTracking()` for read-only EF Core queries and eager-loading (`selectinload`/`joinedload` or explicit projections) to prevent N+1 query patterns.
- Enforce pagination on list endpoints and add indexes for frequent `WHERE`, `JOIN`, and `ORDER BY` columns.
- Keep database transactions short; never perform external HTTP, OpenAI, or Azure AI calls inside an open transaction.
- Enable and verify Row-Level Security (RLS) on any client-accessible Supabase tables.
