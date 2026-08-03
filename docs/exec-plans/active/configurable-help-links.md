# Configurable Help Links

## Goal

Extend `REQ-SET-001` with a Help & Support Links section at the bottom of
Platform Settings > Workspace.

## Scope and boundary

- Reuse the existing settings page, section, field, status, Save, Reset, and
  toast vocabulary.
- Treat this as a platform-wide setting shown in every workspace, not a
  per-workspace control.
- Label the no-override state `Product Default` and the saved state
  `Admin Override`.
- Keep viewers read-only and auditors excluded through the existing fixed
  settings route boundary.
- Preserve the rest of Workspace Settings when an older control plane does not
  return `help_links`.
- Accept only the fixed `help_links` shape and never expose arbitrary setting
  keys or values.

## Validation plan

- Add focused route-policy, response-projection, mock lifecycle, settings UI,
  requirements-baseline, and responsive markup evidence.
- Run requirements, contract, harness, and repository validation.
- Verify `/settings/workspace` in the live browser at desktop and compact widths.

## Outcome

- Added the Help & Support Links section using the existing settings section,
  source badge, card, field, Save, Reset, and toast patterns.
- Full repository validation passes (90/90 tests), including route policy,
  response projection, mock update/reset lifecycle, contracts, requirements,
  harness, production build, and route smoke checks.
- Live browser verification passes at 1440×900 and 390×844; fields render in
  two columns on desktop and stack cleanly at the compact breakpoint.
