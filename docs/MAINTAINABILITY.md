# Maintainability

## Source Budgets

Default source file budget: 650 lines. `src/App.tsx` has a focused budget of 425
lines; the largest shared control modules have focused 275–300 line budgets; and
the mock store retains its 400-line budget. The harness enforces these limits so
routing, projections, pages, shared primitives, and mock behavior are extracted
before they become difficult to review.

## Boundary Ownership

- `lib/admin-route-policy.mjs`: methods, paths, scopes, and query allowlists.
- `lib/admin-contract.mjs`: least-privilege identity and browser response projection.
- `lib/mock-admin-store.mjs`: producer-shaped local fixtures and mutations.
- `server.mjs`: HTTP, upstream custody, and fail-closed orchestration.
- `src/App.tsx`: application shell and route composition only; no upstream
  tokens or raw `/admin/v1` calls.
- `src/pages/`: governance-only route implementations built from shared UI
  primitives.
- `src/styles.css`: application-wide responsive record layouts, safe-area
  handling, and compact/coarse-pointer behavior; route-specific business
  styling stays with route composition.
- `packages/ui/`: the repository-local replica of Management Console's
  domain-neutral tokens and reusable component foundation, including bounded
  shells and viewport-safe overlay geometry.
- `docs/product-specs/current-requirements.md`: human-readable current, excluded, and blocked product baseline.
- `docs/product-specs/requirements-baseline.json`: executable evidence map; never point it at historical completed plans.
- `scripts/check-requirements.mjs`: deterministic requirement-drift enforcement.

## Required Check

Run `npm run requirements:check` for every product change. Run `npm run harness:check` after changing documentation structure, workflows, validation scripts, policy modules, or source organization.
