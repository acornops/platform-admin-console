# Workspace Membership Removal

## Goal

Let platform administrators remove one user's access to one workspace through the existing allowlisted admin membership-delete contract.

## Delivered Scope

- Removed the visible internal user ID from directory rows while retaining it as the row identity and in user details.
- Added a separate `Remove from Workspace` action to every membership entry.
- Required explicit destructive confirmation and explained that the account and other memberships remain unchanged.
- Sent a deterministic contract-required reason and retained the producer's last-owner safeguard.
- Updated membership counts and the empty state in place after a successful `204` response.
- Kept all-workspace removal out of the browser and tracked the missing atomic producer capability as `DEV-011` in `DESIGN.md`.

## Contract And Security Boundaries

- Existing `DELETE /admin/v1/workspaces/{workspaceId}/members/{userId}` and `admin:member:write` only.
- No browser-side bulk loop: the contract has no atomic global removal endpoint and individual failures could leave partial access.
- Last-owner removal may require `replacementOwnerUserId`; the current consumer lacks workspace-member discovery, so the producer's `LAST_OWNER` response remains the fail-closed control.
- The user account is never deleted.

## Validation Evidence

- `npm run validate` — passed, including lint, 32 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Control-plane `npm run contracts:check` — passed.
- Control-plane `npm run harness:check` — passed.
- Live desktop verification — confirmed explicit confirmation, cancellation, successful removal, directory and panel count updates, success toast, persisted count after reload, and admin audit attribution.
- Live owner verification — confirmed the safeguard copy and the producer `LAST_OWNER` error without removing the owner.
- Live compact verification at 390 × 844 — confirmed the role control, lifecycle metadata, and removal action remain legible and usable.
