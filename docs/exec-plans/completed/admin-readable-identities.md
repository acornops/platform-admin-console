# Admin Readable Identities

Status: completed
Branch: `fix/admin-readable-identities`
Producer: `control-plane`

## Goal

Replace raw creator and workspace IDs in routine platform-admin displays with
readable labels while retaining immutable IDs for filtering, details, and
fallback.

## Constraints

- Browser traffic remains on same-origin `/admin-console-api/*`.
- The BFF explicitly projects every new field.
- Creator display order is display name, email, then immutable user ID.
- Audit object display order is workspace name, then immutable workspace ID.
- Operational fields, workspace audit events, and unrestricted metadata remain
  unavailable.

## Requirement Classification

- `REQ-WSP-002`: add a readable creator-display rule.
- `REQ-AUD-001`: replace workspace-ID-first object display with
  workspace-name-first display and immutable-ID fallback.
- `REQ-BND-002` and `REQ-BND-003`: preserved.

## Validation Log

- `npm run validate`: passed.
- All 95 tests passed, including creator-label precedence, immutable-ID
  fallbacks, workspace-name audit objects, and BFF confidentiality projection.
- Lint, contract checks, requirement checks, harness checks, the production
  build, and static/API/denial smoke routes passed.
- The rebuilt `platform-admin-console` container is healthy and connected to the
  rebuilt control plane.
- Live control-plane data resolves `Development Workspace` to creator
  `Dev User`, and all 10 current workspace audit events include
  `workspaceName`.
- Browser rendering reached the healthy platform-admin sign-in flow; final
  authenticated visual inspection requires the user to sign in because no
  reusable authenticated browser session was available.

## Completion Criteria

- Workspace directory and details use readable creator labels.
- Admin Audit uses workspace names in the Object column and details.
- Focused projection and rendering regressions pass.
- Requirements, contract, repository, and live browser checks pass.
