# Kubernetes RBAC Additions

## Requirement classification

This adds `REQ-SET-003`: platform administrators may maintain named, audited
Kubernetes RBAC profiles used only for future cluster onboarding.

## Boundaries

- The browser uses the existing same-origin settings route and a fixed new setting key.
- Helm-owned and admin-owned profiles are presented in a source-aware table.
- Admins edit one profile at a time; only its resource rules are authored as YAML.
- The browser submits an exact overlay of upserts and disabled deployment keys.
- The BFF projects the effective catalog, deployment baseline, and overlay
  separately and rejects arbitrary settings.
- Changes do not reconcile or revoke permissions in existing workspaces or clusters.
- Viewers are read-only; auditors have no settings access.
- Supported profile verbs are `get`, `list`, `watch`, `create`, `patch`, and
  `delete`; patch continues to require list.

## Validation

- Update the human and executable requirements baselines and design register.
- Cover YAML validation, route policy, response projection, mutation shape, and UI states.
- Run requirements, contracts, lint, tests, smoke, harness, and validate.

## Result

Complete. The responsive profile table, source-aware add/edit/restore/disable
actions, strict resource-YAML parsing, fixed route policy, response projection,
requirements, and navigation are implemented. Lint, all 86 tests, requirements,
contracts, harness checks, route smoke, and production build pass. The live
mock-backed page was also inspected at a 1440px viewport.
