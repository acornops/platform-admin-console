# Security Model

## Trust Boundaries

1. The platform administrator signs in through the control plane's dedicated OIDC authorization-code flow with PKCE and IdP-enforced MFA.
2. The browser communicates only with same-origin `/admin-console-api/*` routes.
3. The BFF validates method, route, query names, request size, credential scopes, and response projection.
4. The control plane independently requires both the BFF workload token and the human admin session, intersects both permission sets, validates CSRF and recent authentication for writes, enforces body schemas and invariants, and writes the audit event.
5. Workload-facing services and tenant operational endpoints remain outside the console boundary.

## Secrets

`CONTROL_PLANE_ADMIN_TOKEN` is server-only. It must come from a production secret store, never a browser bundle, cookie value, URL, log, error, test fixture, or committed environment file. The console rejects broad or operational scopes even if the control plane would accept them.

Platform-default LLM keys are accepted only on the fixed provider routes for a
full `platform-admin`. The BFF validates provider, method, body fields, key
length, recent authentication, and CSRF evidence. Successful responses project
only configured status and discard any unexpected upstream secret fields.
Audit events contain provider and action only.

## Authorization

Navigation visibility is not authorization. The BFF route policy and control-plane scope middleware both enforce every request. The consumer credential is denied when it contains `admin:*` or any target, run, tooling, or agent-key scope.

Only `platform-admin`, `platform-admin-viewer`, and `platform-admin-auditor` are accepted. `platform-admin` can read and mutate governance state; `platform-admin-viewer` has governance read access except the protected audit ledger; `platform-admin-auditor` can read only its identity and the admin audit ledger. OIDC roles are checked on the server and are never trusted from browser state.

## Confidentiality

Successful upstream responses are projected before browser delivery. Workspace operational summaries, target identifiers, run identifiers, source-IP hashes, user agents, session hashes, and unrestricted audit metadata are removed. Human audit attribution uses immutable issuer and subject values while preserving the BFF token ID as separate workload evidence. Operational admin-audit action families are filtered out.

## High-Risk Changes

- Adding a route, query parameter, scope, or response field.
- Changing projection or audit filtering.
- Handling tokens, cookies, identity, CSRF, or proxy headers.
- Adding membership removal, owner replacement, suspension, restoration, or purge.
- Adding deployment egress or access to another service.

These require security review, contract checks, positive and negative tests, and an updated `DESIGN.md` deviation decision when behavior differs from the producer DTO.
