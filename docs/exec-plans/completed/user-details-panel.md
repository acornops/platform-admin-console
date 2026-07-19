# User Details Panel

## Outcome

The users directory now remains visible while a user opens in an accessible right-side panel. The panel becomes full-screen on compact layouts, retains the deep-linkable `/users/:userId` route, and restores focus to the selected row when closed.

The desktop panel is capped at 720px. Its header uses the selected user's name and email directly, followed by compact `User Details` and `Workspace Membership` sections. Workspaces are alphabetized, the section header carries the membership count, and duplicate role badges are omitted. Directory verification states use capitalized labels. Raw membership `source` values are omitted because they do not affect authorization; each membership shows a quiet `Added` and non-redundant `Updated` footer beneath its role controls.

Existing workspace memberships expose role selectors populated from `/admin/v1/system/config` `roleTemplateKeys`. `Update Role` remains visible beside each selector, is disabled until the role changes, and applies the change directly after that explicit click. The browser sends a deterministic, contract-required reason without collecting a ticket or free-text reason. The resulting mutation remains attributable by `adminTokenId`, shown explicitly as `Admin Actor` in Admin Audit.

Session access and member creation were removed from the console route policy, browser projection, mock boundary, allowed scopes, and mirrored producer/consumer manifests. The control-plane endpoints remain producer capabilities for other consumers; they are no longer part of this console's 12-route, 7-scope subset.

## Contract Notes

- Producer: `control-plane` `/admin/v1` contract and manifest.
- Consumer: `platform-admin-console` BFF route policy, privacy projection, and mirrored manifest.
- Compatibility: backward-compatible consumer narrowing; no producer endpoint or DTO changed.
- Known limitation: the producer exposes platform-wide role keys, not a workspace-scoped role catalog. `DEV-009` in `DESIGN.md` records this limitation.
- Merge order if published separately: control-plane manifest first, then platform-admin-console.

## Validation

- `platform-admin-console`: `npm run validate` passed; 25 tests, contract checks, harness checks, build, and route smoke checks were green.
- `control-plane`: `npm run contracts:check` and `npm run harness:check` passed.
- Workspace: `node scripts/harness/check-platform-contracts.mjs` could not complete because the existing `agentk/docs/contracts/manifest.json` checkout is missing.
- Browser: verified desktop `1440×900` and compact `390×844`; row/keyboard open, deep link, focus restoration, Escape/close behavior, role confirmation, successful audited role change, and zero-error console state.

## Security And Privacy

- Session fields are stripped from user-detail responses.
- Session audit actions are filtered from the governance audit projection.
- Session revocation and member creation are denied by the console route allowlist.
- Role values are never invented by the browser and every mutation retains the contract-required reason.
