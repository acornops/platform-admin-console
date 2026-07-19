# User Membership Role Updates

## Outcome

Workspace membership editing is faster and easier to scan while preserving the existing `/admin/v1` role-mutation and audit contracts.

- Panel titles use normal title capitalization.
- Membership lifecycle dates form a quiet inline footer beneath the role controls and wrap naturally on small screens; a duplicate `Updated` date is suppressed.
- `Update Role` remains beside the role selector and is disabled until the selected value changes.
- An explicit `Update Role` click applies the mutation without a reason/ticket dialog.
- The browser supplies an accurate system-generated reason required by the producer contract.
- Admin Audit labels the event's `adminTokenId` explicitly as `Admin Actor`.

## Contract And Security Boundaries

- No route, scope, DTO, role catalog, producer schema, or consumer contract mirror changed.
- The browser continues to send only `role` and contract-required `reason`; optional `ticketRef` is omitted for this interaction.
- The two-step select-then-button interaction is the explicit opt-in for the privileged mutation.
- Audit attribution remains credential-level because `/admin/v1/admin-audit-events` exposes `adminTokenId`, not a durable human administrator identity. `DEV-005` tracks that production limitation.

## Validation

- `platform-admin-console`: `npm run validate` passed with 28 tests, contract checks, harness checks, build, and route smoke checks.
- `control-plane`: `npm run contracts:check` and `npm run harness:check` passed; no producer files changed.
- Workspace: `node scripts/harness/check-platform-contracts.mjs` could not complete because the existing `agentk/docs/contracts/manifest.json` checkout is missing.
- Browser: verified desktop `1440×900` and compact `390×844`; title capitalization, lifecycle placement, persistent disabled/enabled/loading control states, successful direct mutation, updated lifecycle date, explicit audit actor, and zero console errors.

## Compatibility

Backward-compatible consumer interaction change. No cross-repository merge order is required because the producer and integration contract are unchanged.
