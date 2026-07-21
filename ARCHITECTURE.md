# Architecture

## Boundary

```text
Platform admin browser
  -> same-origin /admin-auth/*
  -> Platform Admin Console fixed auth-route proxy
  -> Control Plane /admin-auth/* (OIDC login, callback, CSRF, logout)
  -> same-origin /admin-console-api/*
  -> Platform Admin Console BFF
  -> explicit route policy
  -> Control Plane /admin/v1/*
```

The browser never receives the upstream admin token. It holds only a host-only, secure, HTTP-only opaque admin session cookie issued by the control plane plus a signed CSRF token. The BFF has no generic proxy and cannot construct arbitrary upstream paths. Governance operations are declared with method, browser route, upstream route, and risk classification in `lib/admin-route-policy.mjs`. Human-authentication traffic is a separate exact method/path/query allowlist in `server.mjs`; it preserves OIDC redirects and cookie headers but never attaches the BFF workload credential.

## Runtime modes

- `mock` (default): deterministic in-memory governance data for local prototyping.
- `control-plane`: forwards allowlisted operations to `CONTROL_PLANE_ADMIN_BASE_URL` using `CONTROL_PLANE_ADMIN_TOKEN`.

Both modes pass through the same route matcher. Tenant operations are structurally absent, including logs, targets, sessions, runs, agents, commands, tooling, credentials, and workspace audit events.

## Repository boundaries

- This repository owns the UI and BFF policy.
- `control-plane` owns `/admin/v1` authorization and contracts.
- `acornops-deployment` owns production deployment, ingress, network policy, and secret injection. The control plane owns identity verification and authorization.
- `acornops-workspace` tracks coordinated delivery and shared standards.
