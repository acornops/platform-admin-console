# Admin Audit Readability

## Goal

Make the Admin Audit ledger easier to scan by clarifying its governance
boundary, presenting readable event codes and human identities, reducing
unnecessary emphasis, and improving the copied-event-data surface.

## Scope and boundary

- Preserve `REQ-AUD-001`, `REQ-AUD-002`, and `REQ-BND-002`.
- Add only the optional governance-safe `subjectDisplayName` projection from
  the control-plane audit contract.
- Keep immutable workspace, subject, actor, token, and request identifiers out
  of the ledger when a readable label exists and available in Details.
- Keep workspace audit events and unrestricted metadata excluded.
- Preserve the existing filters, pagination, and same-origin BFF route.

## Validation plan

- Add focused formatter, readable-object, projection, and contract tests.
- Run the Admin Audit browser path in light and dark themes.
- Run the console requirements, contract, and repository validation checks.
- Run the workspace platform-contract check with the producer change.

## Validation results

- `npm run validate` — passed.
- Focused React UI and BFF projection tests — 35 tests passed.
- Production browser verification at `1440×900` and `390×844` — passed in
  light and dark themes with no console errors. Actor and Object resolved to
  weight 400; the user object showed `Ivy Tan`; `subjectId: usr_ivy` remained
  in Details; copy-surface backgrounds resolved to `rgb(38, 35, 32)` and
  `rgb(10, 9, 9)`.
- Workspace platform-contract check — passed.

## Completion

`REQ-AUD-001`, `REQ-AUD-002`, and `REQ-BND-002` remain preserved. No excluded
workspace audit, operational, credential, or unrestricted metadata behavior
was introduced.
