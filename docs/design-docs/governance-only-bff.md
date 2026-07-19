# Governance-only BFF

## Decision

Use a small same-origin backend-for-frontend between the browser and control-plane `/admin/v1` routes.

## Rationale

This prevents the upstream token from entering the browser and makes the permitted platform-admin surface reviewable in one policy module. Browser routes do not accept arbitrary upstream paths. Route parameters are encoded and request bodies are forwarded only for declared mutation routes.

## Rejected alternatives

- Direct browser calls: exposes privileged credentials and broadens CORS risk.
- Generic reverse proxy: future or malformed paths could cross the privacy boundary.
- Reusing tenant UI clients: invites accidental imports of operational endpoints.
