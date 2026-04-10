# U2App Python Backend Migration

## Framework decision

FastAPI is the better fit for this repository because the current backend is mostly async-friendly HTTP APIs plus realtime game updates, file uploads, and an external speech API call. Django REST Framework would make more sense if the project were primarily CRUD-heavy with a larger built-in admin workflow.

## Structure

```text
backend/python-service/
  app/
    api/routes/
    core/
    db/
    models/
    repositories/
    schemas/
    services/
    realtime/
    tests/
    main.py
  migrations/
  Dockerfile
  requirements.txt
```

## Run

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:socket_app --reload
```

## Docker

```bash
docker build -t u2app-python-backend .
docker run --env-file .env -p 8000:8000 u2app-python-backend
```

## Tests

```bash
pytest app/tests
```

## Migration strategy

1. Provision PostgreSQL alongside the existing runtime.
2. Apply `migrations/001_initial_schema.sql`.
3. Stand up the FastAPI service in shadow mode behind your gateway.
4. Mirror selected `/convert`, `/speak`, and game traffic to validate parity.
5. Start persisting phonebook, questions, rounds, and submissions into PostgreSQL.
6. Cut over endpoint groups gradually instead of switching everything at once.
7. Keep rollback simple by leaving the .NET and Node.js services deployable until the Python service is stable in production.

## Assumptions and breaking changes

- This repo does not currently include an existing SQL Server, MySQL, or MongoDB schema, so the PostgreSQL SQL here is a target schema for the current game domain rather than a one-to-one database conversion.
- The legacy Node.js game server had no effective admin authentication; this migration introduces JWT-protected admin routes as a production hardening improvement.
- Existing frontend Socket.IO clients can remain compatible because the migrated service keeps the same high-level event model.
