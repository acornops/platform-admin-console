# Platform settings management alignment

Status: complete

## Goal

Align Platform Settings with the management console's Workspace Settings
structure while preserving the platform-admin categories, contracts, and
governance boundary.

## Requirement classification

- Preserve and refine `REQ-UX-001`: reuse the management console's visual and
  interaction vocabulary.
- Preserve and refine `REQ-SET-001`: retain exactly the Workspace and AI
  categories, with their existing setting ownership and mutation behavior.
- Preserve `REQ-SET-002`: keep provider defaults write-only inside AI.

## Boundaries

- Keep `/settings` and every fixed same-origin BFF route unchanged.
- Do not change setting keys, provider operations, payloads, roles, or scopes.
- Keep key values write-only and preserve viewer and auditor restrictions.
- Retain accessible keyboard tabs and compact responsive behavior.

## Validation

- Add focused markup evidence for the management-aligned structure.
- Run the Platform Settings tests and requirements baseline check.
- Run repository validation appropriate to the UI-only risk.
- Compare the running page at desktop and compact viewport sizes.

## Outcome

- Replaced the enclosing ledger card with the management console's compact
  underline tab strip and max-width content column.
- Each setting now uses an independently titled section followed by a quiet
  bordered control surface.
- Preserved the Workspace and AI grouping, fixed contracts, role behavior, and
  write-only provider key handling.
- `npm run validate` passed with 98 tests plus contract, requirements, harness,
  build, and smoke-route checks.
- Live desktop and 390-pixel verification confirmed the 44px tab rhythm,
  keyboard navigation, equal compact tabs, and no horizontal overflow.
