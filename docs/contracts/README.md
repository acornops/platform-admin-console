# Platform Admin Console Contracts

## Source Of Truth

The control plane owns `/admin/v1`. Its route implementation, Zod request schemas, OpenAPI sources, and `control-plane/docs/contracts/manifest.json` are authoritative. This repository mirrors only the approved governance subset in `docs/contracts/manifest.json`.

## Full Platform Matrix

| Producer | Consumer | Surface | Direction |
| --- | --- | --- | --- |
| Control plane | Platform admin console BFF | Fifteen allowlisted `/admin/v1` methods and paths | BFF to control plane |
| Platform admin console BFF | Browser application | Same-origin `/admin-console-api/*` routes with privacy-projected responses | Browser to BFF |

## Platform Dependency Summary

The console has one runtime service dependency: `control-plane`. It does not call the management console, execution engine, LLM gateway, AgentK, AgentV, or workload targets.

## Shared Invariants

- List responses use `{ items, nextCursor? }`.
- Mutations require `reason`; supported mutations also preserve optional `ticketRef`.
- The membership panel satisfies the required role-mutation `reason` with a deterministic description of the previous and next role; it omits optional `ticketRef` rather than collecting either value in another dialog.
- Workspace-access grants identify an existing user by `userId`, force `createUserIfMissing: false`, use a contract-provided role, and supply a deterministic reason.
- The console requires the exact workspace name for suspension and restoration and supplies a deterministic reason without collecting a reason or ticket. Both actions retain memberships, targets, workload state, references, and audit history.
- Workspace limits are plan-defined in this consumer. The legacy producer quota-override endpoint is intentionally excluded from the console subset.
- The upstream credential uses only the mirrored required scopes and is rejected if it contains `admin:*` or operational scopes.
- The consumer subset excludes session access, email-based user resolution, and account creation. It permits workspace-access grants only for existing users.
- Producer errors retain `{ error: { code, message, retryable, details? } }`.
- All console API and producer admin responses use `Cache-Control: no-store`.

## Control-Plane Boundary Notes

- Browser paths are not upstream paths. `lib/admin-route-policy.mjs` owns the fixed mapping.
- Query parameter names are allowlisted per route before forwarding.
- `lib/admin-contract.mjs` projects successful responses before browser delivery.
- Workspace operational summaries and operational admin-audit actions are removed even if the producer returns them.
- Admin audit attribution identifies the authenticated human from immutable OIDC issuer and subject fields, with display name and email snapshots for readability. The BFF workload token remains separate credential evidence.
- Workspace creator and admin-audit object labels are optional producer fields. The BFF projects them explicitly; the browser prefers the readable label and falls back to the immutable creator or workspace ID.
- The mock store emits producer-shaped DTOs before the same projection is applied.
- All accepted deviations are tracked in `DESIGN.md`.

## Change Checklist

1. Compare the control-plane route, Zod schema, OpenAPI schema, and producer manifest.
2. Update both mirrored counterpart objects in the same coordinated change.
3. Update route policy, scope, query allowlist, projection, mock, frontend, and tests together.
4. Add or update the deviation ledger when the browser contract is intentionally narrower.
5. Run `npm run contracts:check`, the control-plane contract check, and the parent cross-repository contract check.
