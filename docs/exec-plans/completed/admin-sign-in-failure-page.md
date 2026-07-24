# Admin Sign-In Failure Page

Status: complete
Branch: `feat/platform-admin-console`
Producer: `control-plane`

## Outcome

Replace raw upstream `5xx` authentication payloads on browser navigations with
a same-origin, no-store sign-in-unavailable page. Keep the request ID visible
for support correlation and provide an explicit retry action.

## Safety

- Only navigational OIDC login/callback failures are rendered as HTML.
- CSRF and logout endpoints retain their JSON contracts.
- Upstream bodies are not reflected into the page.
- Existing auth route allowlists, cookies, redirects, CSP, and workload-token
  separation remain unchanged.

## Validation

- CI validation passed with 86/86 tests, coverage thresholds, contracts,
  requirements, harness, build, and route smoke checks.
- Focused proxy tests cover both a structured control-plane `503` and a
  transport-level upstream failure without reflecting internal details.
