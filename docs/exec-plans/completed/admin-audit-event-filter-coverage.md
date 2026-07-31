# Admin Audit Event Filter Coverage

## Goal

Extend `REQ-AUD-001` with operator-friendly event filters that cover every
mutation available through the Platform Admin Console.

## Scope

- Populate the Event dropdown with six producer-owned mutation groups.
- Preserve the raw event code, outcome, workspace, actor, and time filters.
- Keep all filtering server-side through the existing fixed `actionGroup`
  query.
- Update mock behavior, executable requirements, and focused tests.

## Validation

- Focused React, mock-server, requirements, and route-policy checks.
- Full Platform Admin Console validation.
- Live local browser verification.

## Outcome

- Replaced the exact workspace-plan action option with a lifecycle-complete
  action group.
- Added Platform Settings, Default LLM Keys, and Capability Defaults options
  while retaining Workspace Plan, Workspace Status, and Workspace Access.
- Mirrored all six groups in deterministic local mock filtering.

## Validation Evidence

- `npm run validate`: 82 tests, contract and requirements checks, harness
  checks, production build, and route smoke tests passed.
- Headless Chrome rendered all seven dropdown entries, selected Modified
  Platform Settings, and observed an HTTP 200 request using
  `actionGroup=platform_settings_modified`.
- Browser requests for all six groups returned HTTP 200 and no out-of-group
  actions.
- The isolated browser run used the documented local mock mode because the
  shared control-plane container has unrelated pre-existing migration checksum
  and duplicate-version failures.
