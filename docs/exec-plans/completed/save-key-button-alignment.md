# Save key button alignment

Status: completed

## Goal

Make unconfigured-provider Save key actions visually identical to Rotate key
actions while preserving all write-only key behavior.

## Requirement impact

- Preserves `REQ-SET-002`.
- Reuses the existing secondary outlined CheckCircle action treatment.
- Does not change routes, payloads, authorization, confirmation, or secret
  handling.

## Verification

- `npm run lint` passed.
- `npm run requirements:check` passed.
- `npm run build` passed.
- `git diff --check` passed.
- The local platform-admin console was rebuilt.
- Browser verification confirmed Save key and Rotate key use the same
  `button secondary provider-key-action` classes, CheckCircle icon, and 36px
  desktop height.
- Per the user's standing request, the test suite was not run.
