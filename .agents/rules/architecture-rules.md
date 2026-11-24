---
trigger: always_on
---

# U2App Architecture Rules

## Multi-Service Boundaries

U2App consists of three coordinated layers:

1. **Angular Frontend (`frontend/`)**: Standalone route-based utility modules, UI components (PrimeNG 21 + Angular Material 21), client state, and typed service adapters (HTTP, Firebase/Firestore, Supabase, Socket.IO).
2. **.NET Web API (`backend/dotnet_service/U2Tools.Api/`)**: Enterprise REST APIs, `Controllers/` -> `Services/` -> `Data/` (`U2ToolsDbContext` / SQL Server), `DTOs/`, `Validators/`, `Middleware/`, `Authentication/`, Serilog + OpenAPI.
3. **Python FastAPI & AI Service (`backend/python_service/`)**: AI/RAG pipelines (`standup_note/`, `CH-3_Agent/`), Azure AI/Speech/Blob services (`CH-2_Services/`, `AzureBlobStorageDemo/`), SQLAlchemy 2 / PostgreSQL, and Socket.IO endpoints.

## Mandatory Architectural Constraints

- **Separation of Concerns**:
  - Angular components must not embed raw SQL, hardcoded backend hostnames, or complex business rules better suited for services.
  - .NET controllers and FastAPI routes must stay thin and delegate business rules to dedicated service classes/modules.
  - Never expose EF Core or SQLAlchemy ORM entity classes directly in API responses; always map to DTOs / Pydantic schemas.
- **API & Proxy Routing**:
  - Maintain consistent JSON contracts (`camelCase` JSON fields, ISO-8601 UTC dates, structured error envelopes).
  - Keep specific proxy prefixes (`/api/rag`, `/api/voice`, `/api/tanglish`, `/api/standup-ai`) ordered before the catch-all `/api` rule in `frontend/proxy.conf.json`.
- **Lazy Loading & Modularity**:
  - Lazy-load feature routes and heavy libraries (`three`, `chart.js`, `mermaid`, `xlsx`, `jspdf`, `tesseract.js`) inside their feature modules.
- **Cross-Technology Coordination**:
  - For features spanning multiple layers, align API contracts and database schemas first before implementing frontend and backend changes.
