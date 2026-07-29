# Platform settings categories

Status: complete

## Goal

Replace the single Platform Settings ledger with two top-level categories:
Workspace and AI. Workspace owns member discovery and password signup. AI owns
AI policy and the write-only default LLM keys.

## Boundaries

- Keep the existing `/settings` route and fixed same-origin BFF calls.
- Do not add setting keys, provider operations, payload fields, or scopes.
- Preserve viewer read-only behavior and the auditor route exclusion.
- Keep provider keys write-only and never render submitted values.
- Use accessible tabs with keyboard navigation and responsive reflow.

## Validation

- Add focused markup evidence for the two categories and their section grouping.
- Run the focused Platform Settings test and requirements baseline check.
- Run repository validation appropriate to the UI-only risk.
- Verify both categories in the running local admin console.

## Outcome

- Platform Settings now has exactly two top-level categories: Workspace and AI.
- Workspace groups member discovery and password signup.
- AI groups AI policy and write-only default LLM keys.
- No API contracts, setting keys, provider operations, payload fields, scopes, or
  secret-handling behavior changed.
- `npm run validate` passed with 98 tests, contract, requirements, harness,
  build, and smoke-route checks.
- Desktop, 390-pixel mobile, mouse, and keyboard tab behavior were verified in
  the running UI.
