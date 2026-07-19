# User Workspace Filter And Partial Revoke

## Goal

Let platform administrators find every user with access to a matching workspace and revoke all non-owner access without blocking on safeguarded Owner memberships.

## Delivered Scope

- Changed the Users description to `Review identity and workspace access for AcornOps users.`
- Added a free-text workspace filter with workspace-name and workspace-ID suggestions from the existing admin workspace directory.
- Combined workspace filtering with identity search and verification status, including immediate count refreshes after access revocation.
- Restyled the workspace role selector with the console's warm-neutral surface, border, focus, and chevron treatments.
- Changed the bulk revoke flow to list safeguarded Owner workspaces and revoke every other workspace membership through the existing per-membership delete contract.
- Changed the protected bulk confirmation to `Revoke All Other Access` and disabled it only when no revocable access remains.
- Kept the confidentiality and authorization boundary intact: the implementation uses only allowlisted `/admin/v1` governance reads and membership deletes.
- Recorded the conservative Owner safeguard and temporary client-side workspace access index as DEV-006, DEV-011, and DEV-012 in `DESIGN.md`.

## Validation Evidence

- `npm run validate` — passed, including lint, 34 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Control-plane `npm run contracts:check` — passed.
- Control-plane `npm run harness:check` — passed.
- Live workspace-filter verification — confirmed suggestions for all six fixtures, partial matching for `atlas`, and composition with the Unverified filter.
- Live partial-revoke verification — confirmed Jules retained Cedar Systems Owner access while Atlas Research access was removed, the directory count updated immediately, and the active Atlas filter removed Jules from its results.
- Live safeguard verification — confirmed the dialog lists Cedar Systems, enables `Revoke All Other Access` while another membership exists, and disables the action when only safeguarded Owner access remains.
- Live responsive verification — confirmed the Users directory has no document-level horizontal overflow at a 390 px viewport and keeps table overflow inside the ledger.
