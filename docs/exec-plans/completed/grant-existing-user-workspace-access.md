# Grant Existing User Workspace Access

Status: completed 2026-07-17

## Goal

Let a platform administrator grant an existing AcornOps user access to a workspace from the user details panel through the current admin member-create contract.

## Scope

- Add a compact `Grant Access` action to the Workspace Access section.
- Offer only workspaces the selected user does not already access and roles returned by `roleTemplateKeys`.
- Send the selected existing `userId`, selected role, `createUserIfMissing: false`, and a deterministic audit reason.
- Refresh panel access records, directory workspace count, and workspace-filter state after success.
- Add the existing producer route to the fixed consumer allowlist and mirrored manifests.
- Replace the applicable portion of `EXC-002` with a required existing-user grant workflow while keeping user creation and recovery excluded.

## Security And Contract Boundaries

- Producer: control-plane `POST /admin/v1/workspaces/{workspaceId}/members` and `adminAddWorkspaceMemberSchema`.
- Consumer: same-origin `POST /admin-console-api/workspaces/{workspaceId}/members` mapped by the fixed BFF policy.
- The UI never submits an email and always submits `createUserIfMissing: false`; it cannot create an AcornOps identity.
- The operation retains `admin:member:write`, a deterministic reason, producer quota checks, duplicate protection, and platform-admin audit attribution.
- No tenant data, session access, impersonation, workspace entry, or workload control is added.

## Validation Plan

- Add route, mock, server, UI, requirements, and contract regression coverage.
- Run platform-admin CI-grade validation and control-plane contract/harness validation.
- Run the parent cross-repository contract and targeted platform-harness checks.
- Verify the complete dialog and post-success count update in the live local UI.

## Completion Evidence

- `npm run validate:ci` passed with 43 tests and 94.43% line, 78.72% branch, and 94.44% function coverage.
- Control-plane `npm run contracts:check` and `npm run harness:check` passed.
- Live verification confirmed `Member` as the safe default, a successful grant, a `2 workspaces` panel count, a matching directory count, and the toast `Access to Atlas Research successfully granted.`
- Parent platform contract and harness checks remain blocked before reaching this repository because the declared local `agentk` checkout is missing.
