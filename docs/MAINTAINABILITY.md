# Maintainability

## Source Budgets

Default source file budget: 650 lines. `public/app.js` has a focused budget of 425 lines. The harness enforces these limits so routing, projections, views, and mock behavior are extracted before they become difficult to review.

## Boundary Ownership

- `lib/admin-route-policy.mjs`: methods, paths, scopes, and query allowlists.
- `lib/admin-contract.mjs`: least-privilege identity and browser response projection.
- `lib/mock-admin-store.mjs`: producer-shaped local fixtures and mutations.
- `server.mjs`: HTTP, upstream custody, and fail-closed orchestration.
- `public/app.js`: UI composition only; no upstream tokens or raw `/admin/v1` calls.
- `docs/product-specs/current-requirements.md`: human-readable current, excluded, and blocked product baseline.
- `docs/product-specs/requirements-baseline.json`: executable evidence map; never point it at historical completed plans.
- `scripts/check-requirements.mjs`: deterministic requirement-drift enforcement.

## Required Check

Run `npm run requirements:check` for every product change. Run `npm run harness:check` after changing documentation structure, workflows, validation scripts, policy modules, or source organization.
