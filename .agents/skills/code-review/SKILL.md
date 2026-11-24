---
name: code-review
description: >-
  Guides structured code reviews across Angular 21, .NET 10, Python FastAPI,
  and SQL in U2App. Use when reviewing pull requests, local git diffs, or
  existing modules for correctness, clean code, architecture, security, and
  performance.
---

# Code Review

Performs thorough, prioritized, and actionable code reviews tailored to U2App's Angular, .NET, Python, and database stack.

## When to Use

- Reviewing local changes (`git diff`), pull requests, or newly implemented features before merging.
- Auditing an existing feature module, API controller, FastAPI service, or SQL script for quality, security, and performance risks.

## Technical Guidelines

- Evaluate every change across five pillars: **Correctness**, **Architecture & Clean Code**, **Security**, **Performance**, and **Tests & Verification**.
- Inspect surrounding code and callers—not only diff lines—to catch contract breaks, side effects, and missed reuse opportunities.

## Coding Standards

- Verify adherence to `frontend/tsconfig.json` strictness, `.prettierrc`, `.editorconfig`, C# nullable safety, and Python PEP 8 + type hints.
- Flag duplicated logic that should reuse existing services, DTOs, components, or utilities.
- Ensure error handling is explicit, structured, and user-safe across all layers.

## Step-by-Step Implementation Approach

1. Inspect the scope of changes (`git status`, `git diff`) and understand the feature or bug-fix intent.
2. Check architectural boundaries: thin Angular components, thin .NET controllers/FastAPI routes, typed contracts, clean DI.
3. Audit security controls: input validation, parameterized queries, auth/authz checks, secret handling, CORS, XSS/injection safety.
4. Audit performance: Angular subscription cleanup & change detection, EF Core/SQLAlchemy N+1 queries & indexes, non-blocking Python async I/O.
5. Check test coverage and verify builds/tests pass when runnable.
6. Present findings grouped by severity (`Critical`, `High`, `Medium`, `Positive`) with exact file paths, line numbers, and concrete remediation steps.

## Best Practices

- Be specific and constructive: explain *why* an issue matters and show the minimal recommended fix.
- Prioritize real bugs, security risks, and maintainability hazards over bikeshedding.
- Call out well-designed patterns to reinforce team standards.

## Common Mistakes to Avoid

- Reporting style nitpicks while missing security, concurrency, or data-integrity bugs.
- Flagging false positives without checking how a function is called or typed elsewhere in the repo.
- Making unrequested source code edits during a review-only task.

## Testing and Validation

1. Confirm all referenced file paths and line numbers exist and match current workspace state.
2. Where appropriate, run non-destructive checks (`npm run build`, `dotnet build`, `pytest`) to corroborate review findings.
