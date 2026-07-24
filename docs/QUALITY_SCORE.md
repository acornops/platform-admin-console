# Quality Score

| Area | Score | Evidence | Main Gap |
| --- | ---: | --- | --- |
| Security boundary | 5/5 | OIDC human sessions, CSRF and recent-auth checks, separate scoped BFF credential, route/query allowlist, response projection, security headers | Periodic live IdP and mTLS exercise remains an operational responsibility |
| Contract alignment | 5/5 | Mirrored manifests, producer-aware checker, producer-shaped mocks and mutation bodies, authoritative paginated member reads | No automated live control-plane fixture yet |
| Harness strength | 5/5 | CI and release workflows, canonical validation, executable current/excluded/blocked requirements, docs checks, source budgets, cross-repo manifest check | Container and chart publication still require repository secrets and GitHub environment policy |
| Reliability | 4/5 | Timeouts, body cap, live/readiness probes, structured request logs, fail-closed projection, deterministic mocks | Dedicated console metrics and production alert rules |
| Accessibility | 4/5 | Semantic UI, focus states, native dialog, responsive layout | Automated accessibility scanner not yet installed |
| Production readiness | 4/5 | Human OIDC identity, MFA/recent-auth enforcement, isolated Helm workload, mTLS support, release provenance, audited lifecycle contracts | Deployment-specific IdP, secret, TLS, alerting, backup, and rollback verification must pass before promotion |

The repository is production-shaped and fail-closed. Capabilities still listed as contract-blocked in `DESIGN.md` are deliberately absent, not release dependencies. A live promotion still requires the environment-specific checks in `docs/OPERATIONS.md`.
