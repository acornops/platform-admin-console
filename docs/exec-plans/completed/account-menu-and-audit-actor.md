# Account Menu And Audit Actor

## Objective

Match the management console's clickable bottom account bar while keeping the
platform-admin identity boundary narrow, and make the Admin Audit Actor column
show one human-readable administrator name.

## Requirement Classification

- Preserve and refine `REQ-UX-001`: the existing account bar becomes an
  accessible account menu with System, Light, and Dark appearance preferences
  plus Logout.
- Preserve and refine `REQ-AUD-001`: the ledger Actor cell displays only the
  recorded human administrator display name, with email and subject as honest
  fallbacks. The detail record retains complete governance-safe attribution.
- Preserve `REQ-AUTH-001` and `REQ-AUD-002`: logout remains CSRF-protected and
  immutable actor evidence remains unchanged.

## Scope Decision

Do not add Account Settings. Platform administrator identity, credentials, MFA,
and profile lifecycle belong to the external IdP. The console has no local
account mutation contract, and adding a settings route would imply unsupported
authority.

## Implementation

1. Added the management-aligned account trigger, identity popover, theme
   submenu, and logout action.
2. Persisted the appearance preference locally and applied the system theme
   without exposing identity or credentials to browser storage.
3. Rendered one readable actor value in each audit row while preserving full
   audit details and filtering behavior.
4. Updated executable requirements and focused regression evidence.
5. Ran repository validation and live browser checks.

## Completion Evidence

- `npm run validate:ci` passed: 76 tests, lint, coverage, contract checks,
  requirements checks, harness checks, build, and route smoke tests.
- Live browser verification confirmed the account menu, Escape dismissal,
  System/Light/Dark choices, theme persistence across reload, and the projected
  administrator identity.
- Live browser verification confirmed every Admin Audit Actor cell contains one
  readable value (`Local Platform Admin`) with no role subtitle.
- No admin API route, IdP contract, logout contract, audit event shape, or
  governance data boundary changed.
