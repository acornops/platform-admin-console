# Admin Audit Event Sentences

## Goal

Make the Admin Audit ledger immediately readable by presenting one
natural-language event sentence per row and keeping the route description on
one line at wide desktop widths.

## Scope and boundary

- Replace the segmented action-code line in `REQ-AUD-001`.
- Derive contextual sentences for known events and use the recorded
  deterministic reason when it supplies detail that is absent from the
  projected event.
- Keep the exact humanized action code, outcome, identifiers, and projected
  evidence in Details.
- Preserve the existing filters, pagination, same-origin route, privacy
  projection, and exclusion of workspace audit events.
- Allow the route description to wrap on compact layouts to prevent horizontal
  overflow.

## Validation plan

- Add focused formatter and rendered-source regression coverage.
- Run the requirements baseline check and the repository validation suite.
- Verify the Admin Audit route at wide desktop and compact viewport sizes.

## Validation results

- `npm run validate` — passed: lint/typecheck, 76 tests, contract checks,
  requirements checks, harness checks, production build, and route smoke
  checks.
- Focused audit tests — 12 passed.
- Rendered Chrome verification — at `1440×900`, the description resolved to
  one 24-pixel line with `white-space: nowrap`; at `390×844`, it wrapped to
  three lines with no horizontal overflow.
- Rendered rows used contextual event sentences and contained no segmented
  `Admin · Workspace` text.

## Completion

`REQ-AUD-001` now replaces segmented table codes with natural-language event
sentences. Exact action codes and outcomes remain available in Details.
`REQ-AUD-002` and the existing confidentiality exclusions remain preserved.
