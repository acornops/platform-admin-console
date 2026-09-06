# Platform Release Hardening

## Integration — 2026-09-07

Implementation is complete. The user authorized fresh verification followed by
committing and pushing these changes directly to `main`. Earlier no-commit
statements below describe the initial implementation task, not this integration.
No deployment or production data mutation is authorized. Final integration
verification follows:

Fresh `npm run validate` passed (94 tests, lint, requirements, contracts,
harness, build and smoke). `PLAYWRIGHT_MODULE_PATH=<management-console
node_modules/playwright/index.mjs> node scripts/verify-directory-hardening-browser.mjs`
passed all five tests; the same module with
`node scripts/verify-hosted-policy-browser.mjs` passed. Final requirements,
contract, harness and diff checks passed after closing this plan.

## Implementation record — 2026-09-06

Status: implemented and consumer-validated; coordinated producer contract gate
also passes. Awaiting integration. No commit, push, or deployment authorized.

## Scope

Preserve REQ-WSP-001, REQ-USR-001/007/009, REQ-UX-001 and REQ-DEF-001.
Fix stale directory responses and retained-data error visibility; replace the
unbounded user-detail fan-out with additive producer-side workspaceQuery
filtering and ordinary 25-row cursor pages. Associate existing grant, plan,
and skill-import labels without changing appearance or hosted-policy behavior.
No EXC-* reversal or BLOCK-* capability is included.

## Sequence

1. Reproduce races, pagination/failure behavior and accessible names in browser tests.
2. Add bounded literal workspace name-or-ID filtering to the producer user list,
   bind it to cursor signatures, mirror the contract, BFF and mock.
3. Guard directory request lifetime, show retained-data errors with retry,
   preserve pagination and update label associations.
4. Run focused producer/BFF/browser regressions and full console validation.

## Validation and rollout

Behavior evidence uses controlled local API failures and delayed responses, not
tenant data. Run npm run validate, producer contract/type/style checks, and the
parent contract check. Ship the backward-compatible producer before the consumer;
roll back the consumer first. Record exact evidence at completion.

## Evidence — 2026-09-06

- `npm run validate`: passed; lint, 94 tests, contracts, requirements, harness,
  build and smoke routes. No excluded or blocked capability was revived.
- `PLAYWRIGHT_MODULE_PATH=../management-console/node_modules/playwright/index.mjs
  node scripts/verify-directory-hardening-browser.mjs`: five behavior tests pass
  (out-of-order responses, retained failures/retry, bounded users without detail
  reads, form accessible names/keyboard and exact-name help, cursor retry, and
  single-membership revocation synchronization). Use an absolute module path
  when running the command because dynamic imports resolve from the script.
- Same Playwright module with `node scripts/verify-hosted-policy-browser.mjs`:
  passed five pools, retain-existing downgrade confirmation, versioned intents,
  exact-name admin hold changes and mobile overflow.
- Producer: `npm run typecheck`, `npm run style:check`, `npm run build`, and
  nine focused admin unit tests passed. PostgreSQL regression passed with 1,000
  transaction-local fixture users: 137 literal-name matches across six 25-row
  pages, combined verification/search, ID substring, no duplicates, correct
  counts, and empty results. Temporary tables rolled back; no shared data changed.
- Parent `node scripts/harness/check-platform-contracts.mjs`: passed.
- Producer `npm run contracts:check`: passed after bringing the clean docs
  checkout to its existing upstream hosted-capacity revision. Consumer mirror
  passes; there was no missing runtime route.

Residual scope: workspace suggestions and lifecycle-status filtering retain the
existing complete workspace-catalog cursor walk. The removed scale hazard is the
all-user detail fan-out. No live tenant data, production deployment, commit, or
push was performed. Platform-admin-change preserved governance, last-owner,
fixed-route, credential and hosted-policy constraints.
