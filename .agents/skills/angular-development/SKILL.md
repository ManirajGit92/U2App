---
name: angular-development
description: >-
  Guides Angular 21 frontend development in U2App using standalone components,
  strict TypeScript 5.9, Signals, RxJS 7.8, PrimeNG 21, Angular Material 21,
  and SCSS. Use when creating or updating Angular components, services, routes,
  forms, state management, or UI features inside frontend/.
---

# Angular Development

Builds and maintains Angular 21.2 features in `frontend/` using standalone components, strict TypeScript, reactive patterns, and PrimeNG/Material UI libraries.

## When to Use

- Creating new utility tools, pages, dialogs, or reusable UI components in `frontend/src/app/`.
- Adding or modifying Angular routes, guards, interceptors, or HTTP/Firebase/Supabase services.
- Refactoring Angular state management (Signals, RxJS, or NgRx) and optimizing template performance.

## Technical Guidelines

- **Framework Version**: Angular `21.2.x`, TypeScript `~5.9.2`, RxJS `~7.8.0`, PrimeNG `21.1.x`, Angular Material `21.2.x`.
- **Architecture**: Prefer standalone components (`imports: [...]`) and route-level lazy loading (`loadComponent` / `loadChildren`) in `frontend/src/app/app.routes.ts`.
- **Reactivity**: Use Angular Signals (`signal`, `computed`, `effect`, `input`, `output`) for local/synchronous UI state and RxJS (`HttpClient`, `switchMap`, `catchError`, `takeUntilDestroyed`) for async streams.
- **Styling**: Use SCSS (`inlineStyleLanguage: "scss"`), component-scoped styles, and existing PrimeNG/Material themes before adding custom CSS.

## Coding Standards

- Honor `frontend/tsconfig.json`: `strict`, `strictTemplates`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`.
- Follow `.prettierrc` (`printWidth: 100`, `singleQuote: true`, Angular HTML parser) and `.editorconfig` (2-space indent).
- Use `app` selector prefix for components; name files `*.component.ts`, `*.service.ts`, `*.model.ts`.
- Avoid `any`; define explicit interfaces/types for all API payloads and component inputs.

## Step-by-Step Implementation Approach

1. Inspect `frontend/src/app/app.routes.ts`, existing sibling features, and shared services/components to reuse existing patterns.
2. Define typed models/interfaces and create or extend the feature service for API/Firebase/Supabase communication.
3. Build standalone components using modern Angular control flow (`@if`, `@for` with `track`, `@switch`).
4. Implement loading, empty, and error states with clear user feedback.
5. Wire lazy-loaded routes and verify responsive layout across desktop and mobile viewports.

## Best Practices

- Use `inject()` for dependency injection and `ChangeDetectionStrategy.OnPush` where appropriate.
- Always clean up subscriptions via `async` pipe, `toSignal()`, or `takeUntilDestroyed()`.
- Keep business and HTTP logic in services; keep components focused on presentation and user interaction.
- Read API base URLs from `frontend/src/environments/` or `frontend/proxy.conf.json` routes.

## Common Mistakes to Avoid

- Subscribing inside components without unsubscribing (memory leaks).
- Calling functions/methods directly inside templates that recompute on every change detection cycle.
- Mutating shared state objects in place instead of creating immutable updates.
- Hardcoding `http://localhost:...` URLs or API secrets inside TypeScript files.

## Testing and Validation

1. Run `npm run build` in `frontend/` and confirm zero TypeScript or Angular template errors.
2. Run `npm test` in `frontend/` to execute Vitest unit tests for new or modified logic.
3. Verify affected routes and proxy calls locally via `npm run start:frontend`.
