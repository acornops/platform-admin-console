# Manual Skill Defaults

## Goal

Match the Management Console skill actions by exposing separate `Import skill`
and `Create skill` buttons in Platform Admin, while retaining explicit
availability selection for Agents, Kubernetes, and Virtual machines.

## Scope and boundary

- Extend the existing workspace-default contract with a backward-compatible
  manual skill source variant.
- Keep skill files bounded, write-only, validated by the control plane, and
  excluded from Platform Admin responses.
- Reuse the existing destination selector in both skill dialogs.
- Materialize inherited manual defaults as ordinary workspace-owned manual
  skills after explicit enablement.
- Preserve Git import behavior, credentials exclusions, and the fixed
  same-origin BFF route.

## Validation plan

- Add focused producer-schema, consumer-sanitizer, response-projection, and UI
  regression coverage.
- Verify inherited manual skills across Agent and target resolution paths.
- Run both repository validation entrypoints and the workspace platform
  contract check.
- Regenerate and validate the public/admin OpenAPI artifact.

## Outcome

- Added separate `Import skill` and `Create skill` actions.
- Reused the Agents, Kubernetes, and Virtual machines selector in both dialogs.
- Added the strict manual source variant without widening routes, roles, or
  credential handling.
- Verified the Create Skill dialog and manual source rendering in a live mock
  browser session.
