# Read Audit Remnant Cleanup

## Goal

Prevent legacy read-only events from appearing in Admin Audit and remove stale
consumer allowlisting and documentation.

## Scope

- Defensively exclude `.read` and `.search` actions at the BFF projection.
- Remove the obsolete `admin.admin_audit.*` action-family allowlist.
- Replace stale read-event examples in the accepted requirement.
- Keep mutation event sentences and raw action/outcome subtext unchanged.

## Validation

- Full repository validation passed with 78 tests plus lint, contracts,
  requirements, harness, production build, and route smoke checks.
- Negative projection fixtures prove legacy `.read` and `.search` actions are
  removed while mutation events remain visible.
- Runtime source contains none of the removed read-audit action literals or
  `highRiskRead` logic.

## Completion

The obsolete `admin.admin_audit.*` consumer allowlist and stale read-event
example were removed. The BFF defensively excludes legacy read/search actions.
