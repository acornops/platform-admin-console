# Reliability

## Runtime Controls

- Upstream requests use a bounded timeout.
- Request bodies have a fixed size limit.
- Static assets and governance responses use explicit cache policies.
- Upstream errors are normalized without leaking credentials or response internals.
- Navigational OIDC `5xx` failures render a no-store retry page with request correlation instead of raw upstream JSON.
- `/health/live` reports process liveness without depending on the control plane.
- `/health/ready` verifies production configuration and the control-plane `/ready` endpoint, returning `503` when upstream is unavailable.
- Structured request logs include request ID, route template, status, and duration without logging tenant content, tokens, or raw identifiers.

## Failure Modes

Read-only views surface a retry action. Mutations are not automatically retried. The browser shows a stable error message and keeps the operator's current context. Production monitoring should derive availability, upstream latency, allowlist-denial, and mutation-outcome signals from the structured logs until dedicated console metrics are added.

- Missing or broad admin scopes fail closed before the requested route is called.
- Unknown routes and query parameters return a stable denial.
- Non-JSON, unavailable, or timed-out upstream responses are normalized without token or upstream-body leakage.
- Projection failures return an error instead of forwarding an unreviewed response.
- Mock mutations are in-memory and reset on restart.

## Required Validation

- `npm run test` for policy, contract, projection, mutation, and HTTP behavior.
- `npm run contracts:check` for producer/consumer drift.
- `npm run requirements:check` for current behavior, removed-behavior exclusions, and blocked-capability drift.
- `npm run smoke:routes` for runnable route and denial evidence.
- `npm run validate` before handoff.
