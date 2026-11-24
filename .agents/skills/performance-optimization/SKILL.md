---
name: performance-optimization
description: >-
  Guides frontend, backend, AI/RAG, and database performance optimization in
  U2App across Angular 21, .NET 10, Python FastAPI, SQL Server, and PostgreSQL.
  Use when profiling slow pages, large bundles, slow API responses, high LLM
  latency, or expensive database queries.
---

# Performance Optimization

Identifies and eliminates real performance bottlenecks across U2App's Angular UI, .NET Web API, Python FastAPI/AI services, and SQL databases using measurement-first engineering.

## When to Use

- Reducing Angular initial bundle size, slow renders, or memory leaks (`frontend/`).
- Speeding up slow .NET 10 or Python FastAPI endpoints, RAG retrieval, or file processing.
- Eliminating database N+1 queries, full table scans, or lock contention in SQL Server or PostgreSQL.

## Technical Guidelines

- **Measure First**: Profile and establish a baseline before optimizing (Angular build stats, browser DevTools Performance/Network, .NET Serilog timings, FastAPI request timing, SQL `EXPLAIN ANALYZE` / Execution Plans).
- **Angular 21**: Route-level lazy loading (`loadComponent`), `@defer` for heavy widgets (Three.js, Chart.js, Mermaid, Tesseract.js, jsPDF, xlsx), `ChangeDetectionStrategy.OnPush`, Signals, `@for (...; track item.id)`, virtual scrolling (`@angular/cdk/scrolling`) for large lists.
- **.NET 10**: `AsNoTracking()` for read queries, DTO projection (`.Select`), pagination, `CancellationToken`, response compression/caching where appropriate.
- **Python / FastAPI / AI**: Non-blocking async I/O (`httpx.AsyncClient`), connection pooling, streaming LLM responses where supported, caching embeddings/retrieval results, bounded chunk counts.

## Coding Standards

- Avoid premature micro-optimizations that harm readability without measurable gains.
- Document any caching strategy with explicit TTL and invalidation rules.
- Always enforce pagination or upper limits on list/search endpoints.

## Step-by-Step Implementation Approach

1. Capture baseline metrics (latency, bundle size, query time, memory/CPU).
2. Identify the dominant bottleneck (network payload, bundle weight, render thrashing, N+1 DB calls, or blocking I/O).
3. Apply targeted optimizations (lazy loading, indexing, query projection, async concurrency, or caching).
4. Re-measure with the same workload to verify measurable improvement.
5. Run builds and tests to ensure correctness is preserved.

## Best Practices

- Keep heavy libraries (`three`, `chart.js`, `mermaid`, `xlsx`, `jspdf`, `tesseract.js`) lazy-loaded inside their specific feature routes rather than eagerly imported in `app.ts`.
- Batch independent async I/O calls (`Promise.all` / `forkJoin`, `Task.WhenAll`, `asyncio.gather`) instead of awaiting sequentially in loops.
- Project only required database columns instead of loading full entity graphs.

## Common Mistakes to Avoid

- Optimizing without profiling or measuring before/after impact.
- Introducing unbounded in-memory caches that grow indefinitely and cause OOM crashes.
- Running synchronous CPU-heavy or network-blocking work on the FastAPI async event loop.

## Testing and Validation

1. Compare before/after metrics (e.g., `npm run build` bundle report, endpoint response times, SQL query plans).
2. Run `npm run build`, `npm test`, `dotnet build`, and `pytest` to confirm zero functional regressions.
