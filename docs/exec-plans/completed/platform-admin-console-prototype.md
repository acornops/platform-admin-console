# Platform Admin Console Prototype

Status: completed on 2026-07-16

## Outcome

Delivered a runnable, governance-only prototype in a fresh repository. It demonstrates workspace and user discovery, access recovery through member add or owner promotion, plan/quota administration, session revocation, and platform-admin audit history without tenant operational access.

## Completion evidence

- The browser uses only same-origin `/admin-console-api/*` routes.
- The BFF maps exactly 14 reviewed `/admin/v1` contracts and has no generic proxy.
- Policy tests deny logs, targets, runs, tenant audit, arbitrary paths, and wrong methods.
- Mock mode demonstrates permitted actions without external dependencies.
- Workspace suspension is disabled and explicitly names the missing contract.
- `npm run validate:ci` passes syntax, 14 tests, enforced coverage, contract drift, harness, build, and route smoke checks.
- Browser verification covered desktop overview/detail, workspace search, the access-recovery confirmation flow, its resulting audit mutation, and compact responsive rendering. A focus-outline and compact scrim issue found during verification were corrected.

## Cross-repository follow-up

Shared branch slug: `feat/platform-admin-console-prototype`.

1. `control-plane`: add lifecycle suspension/recovery, human-admin correlation, and member-read contract gaps.
2. `platform-admin-console`: consume only reviewed contracts and add production identity/session handling.
3. `acornops-deployment`: deploy isolated hostname, identity, secret, and network policy.
