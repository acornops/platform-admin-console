# Workspace Access Revocation UI

## Goal

Make single-workspace and all-workspace access revocation clear, compact, and fail-closed in the user details panel.

## Delivered Scope

- Renamed the user-panel section to `Workspace Access` and the directory count column to `Workspaces`.
- Replaced the footer text action with a compact user-minus icon beside `Update Role`.
- Added the `Revoke workspace access` hover tooltip and a workspace-specific accessible name.
- Added a section-level `Revoke All Access` action beside the workspace count.
- Added quiet-danger owner safeguards and disabled confirmation for both individual and all-access owner cases.
- Kept counts, empty states, directory state, audit behavior, and responsive layouts synchronized after revocation.

## Contract And Security Boundaries

- Uses only the existing allowlisted `DELETE /admin/v1/workspaces/{workspaceId}/members/{userId}` contract through the same-origin BFF.
- Never deletes the AcornOps account, sessions, workspace, or tenant data.
- Owner revocation is blocked in the consumer before a request is sent; the producer safeguard remains authoritative.
- The all-workspace action is non-atomic because no bulk endpoint exists. It executes the existing delete contract sequentially, blocks when any current membership is an owner, updates only successful removals, and reports partial failure without claiming full success.
- `DESIGN.md` ledger entry `DEV-011` records this temporary browser-orchestration deviation and the required production replacement.

## Validation Evidence

- `npm run validate` — passed, including lint, 32 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Control-plane `npm run contracts:check` — passed.
- Control-plane `npm run harness:check` — passed.
- Live desktop verification — confirmed the revised hierarchy, single confirmation, bulk confirmation, bulk success, synchronized zero-access state, and success toast.
- Live owner verification — confirmed individual and all-access owner explanations, quiet-danger presentation, and disabled confirmation buttons.
- Live compact verification at 390 × 844 — confirmed a 390px panel, 44px revoke control, role actions on one row beneath the selector, and no horizontal overflow.
- Tooltip and accessibility verification — confirmed exact tooltip copy in CSS and a workspace-specific accessible button name in the live accessibility tree.
