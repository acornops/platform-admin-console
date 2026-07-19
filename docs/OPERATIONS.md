# Operations Guide

## Runtime Modes

- `mock`: deterministic local contract fixtures; default.
- `control-plane`: allowlisted upstream integration.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `HOST` | No | Bind host; source execution defaults to `127.0.0.1`. The production image sets `0.0.0.0` so Kubernetes Services can reach the non-root process. |
| `PORT` | No | Bind port; defaults to `4173`. |
| `ADMIN_CONSOLE_DATA_MODE` | No | `mock` or `control-plane`. |
| `CONTROL_PLANE_ADMIN_BASE_URL` | Control-plane mode | Control-plane origin. |
| `CONTROL_PLANE_ADMIN_TOKEN` | Control-plane mode | Server-only least-privilege admin bearer token. |
| `CONTROL_PLANE_ADMIN_TLS_CA_FILE` | Internal TLS | PEM CA used to verify the control-plane service. |
| `CONTROL_PLANE_ADMIN_TLS_CERT_FILE` | Internal mTLS | PEM client certificate for this BFF. |
| `CONTROL_PLANE_ADMIN_TLS_KEY_FILE` | Internal mTLS | PEM client private key for this BFF. |

The token must contain only the scopes listed in the mirrored manifest. `admin:*` and target, run, agent-key, and tooling scopes are rejected.

## Health and readiness

`GET /health/live` is a local process check. `GET /health/ready` validates production configuration and calls the control-plane `/ready` endpoint; it returns `503` when upstream is unavailable. The governance readiness view remains a separate authenticated BFF request to `/admin/v1/system/readiness` and is not used as the Kubernetes probe.

## Deployment Requirements

Production startup rejects mock mode. Deployment uses a dedicated admin hostname and OIDC client, host-only secure cookies, CSRF controls, a control-plane-only application egress policy, TLS/mTLS, one-hour privileged sessions, and centralized security monitoring. Enable only the `platform-admin`, `platform-admin-viewer`, and `platform-admin-auditor` roles. This console has no password-login or self-signup path; authentication is redirected to the IdP.

Before live promotion, verify the exact hostname and callback URI, IdP issuer/audience/MFA claim, secret rotation path, internal CA and client certificate chain, NetworkPolicy DNS and control-plane connectivity, ingress TLS, structured-log ingestion and alerting, control-plane and Redis backup/restore procedures, image signature/provenance policy, rollback image, and a post-deploy login/read/write/audit smoke test. Do not enable contract-blocked capabilities as an operational workaround.

## Incident Guidance

- Revoke or rotate a suspected admin token in the control-plane token configuration.
- Treat unexpected `ADMIN_CREDENTIAL_REJECTED` as a scope or configuration incident.
- Never enable a denied route to work around an operational incident.
- Preserve platform-admin audit events and request IDs for investigation.
