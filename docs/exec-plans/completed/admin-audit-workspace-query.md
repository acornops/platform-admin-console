# Admin Audit Workspace Query

## Goal

Extend `REQ-AUD-001` so its workspace filter accepts a workspace name or ID
while preserving the existing protected Admin Audit boundary.

## Scope

- Forward only the producer-owned `workspaceQuery` parameter.
- Use one workspace name-or-ID field in the Admin Audit UI.
- Match the same behavior in local mock data.
- Update requirements, design, contract documentation, and executable evidence.
- Retain the producer's exact `workspaceId` parameter for compatibility.

## Validation

- Route-policy, mock-server, React UI, contract, and requirements tests passed.
- Full Platform Admin Console validation passed (79 tests).
- Producer type, style, contract, OpenAPI, harness, build, and focused audit
  tests passed.
- Docs website validation and link checks passed with bundled Node 24.
- Cross-repository contract validation passed.
