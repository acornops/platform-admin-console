# Platform Admin Console Contracts

AI Policy retains optional `additionalProviderModels` metadata independently of
enabled `providerModels`. The default-off `constraints.allowAdditionalModels`
capability permits the inline Add model form only for existing permitted
providers. The BFF bounds additional IDs and projects no provider configuration
or credentials. Existing versioned setting writes and reset routes are unchanged;
see the mirrored `aiPolicySetting` manifest contract for bounds and rollout rules.

The additive `workspaceQuery` user-list parameter matches a case-insensitive
literal substring of a membership workspace name or ID (maximum 200 characters).
It combines with existing user filters and participates in the cursor signature.
The console requests 25 summaries at a time; failures remain visible and no
per-user membership fan-out is used. Deploy the control-plane producer first,
then this consumer. Roll back the consumer first. No route, scope or response
field is added; privacy projection and last-owner enforcement are unchanged.

## Source Of Truth

The control plane owns `/admin/v1`. Its route implementation, Zod request schemas, OpenAPI sources, and `control-plane/docs/contracts/manifest.json` are authoritative. This repository mirrors only the approved governance subset in `docs/contracts/manifest.json`.

## Full Platform Matrix

| Producer | Consumer | Surface | Direction |
| --- | --- | --- | --- |
| Control plane | Platform admin console BFF | Twenty-nine allowlisted `/admin/v1` methods and paths | BFF to control plane |
| Platform admin console BFF | Browser application | Same-origin `/admin-console-api/*` routes with privacy-projected responses | Browser to BFF |

## Platform Dependency Summary

The console has one runtime service dependency: `control-plane`. It does not call the management console, execution engine, LLM gateway, AgentK, AgentV, or workload targets.

## Shared Invariants

- List responses use `{ items, nextCursor? }`.
- Mutations require `reason`; supported mutations also preserve optional `ticketRef`.
- The membership panel satisfies the required role-mutation `reason` with a deterministic description of the previous and next role; it omits optional `ticketRef` rather than collecting either value in another dialog.
- Workspace-access grants identify an existing user by `userId`, force `createUserIfMissing: false`, use a contract-provided role, and supply a deterministic reason.
- The console requires the exact workspace name for suspension and restoration and supplies a deterministic reason without collecting a reason or ticket. Both actions retain memberships, targets, workload state, references, and audit history.
- Workspace limits combine the selected plan and existing explicit resource overrides. The policy GET projects read-only quotaOverrides, effectiveLimits, five-pool aggregate execution usage, policyVersion and independent admin/external holds. The quota-override mutation endpoint remains excluded from the console subset.
- The upstream credential uses only the mirrored required scopes and is rejected if it contains `admin:*` or operational scopes.
- The consumer subset excludes session access, email-based user resolution, and account creation. It permits workspace-access grants only for existing users.
- Producer errors retain `{ error: { code, message, retryable, details? } }`.
- All console API and producer admin responses use `Cache-Control: no-store`.
- Platform-default LLM key status and replacement use only the fixed
  `/admin/v1/system/llm-provider-defaults` routes. Keys are write-only; the
  browser receives only provider, configured, enabled, and source status.
- Platform User Sign-In Methods uses the fixed `/admin/v1/system/settings/user_sign_in_methods`
  setting. The BFF accepts and projects only `{ methods: ["password"|"oidc", ...] }`,
  requires at least one unique method, and projects only `allowedMethods` plus
  per-method deployment blockers.
- Platform Help & Support Links uses the fixed
  `/admin/v1/system/settings/help_links` setting. The BFF accepts and projects
  only `documentationUrl` and `supportUrl`, applies the producer's protocol and
  length bounds, and restores built-in product defaults when reset.
- Platform Kubernetes RBAC additions use the fixed `/admin/v1/system/settings/kubernetes_rbac_additions`
  setting. The browser projects the effective and deployment catalogs and
  mutates only a strict `{ upserts, disabledKeys }` overlay. Profile YAML is
  parsed into exact `get`, `list`, `watch`, `create`, `patch`, and `delete`
  rules before submission; cluster onboarding
  snapshots are owned by the control plane and are not reconciled after registration.
- Workspace defaults use a non-empty unique `availableIn` array containing
  `agents`, `kubernetes`, and/or `virtual_machines`; the scalar list query tests
  membership. The MCP browser request contains only name, HTTPS endpoint,
  destinations, and reason; the BFF injects the producer's `none`
  authentication compatibility value and never projects MCP authentication
  metadata back to the browser. Skill creation accepts a bounded manual
  Markdown bundle, while skill import accepts a bounded pinned public
  GitHub/GitLab snapshot. Neither flow returns bundle contents. Enabled
  definitions are copied once into a new workspace as disabled workspace
  starters. Enabling a starter creates a detached, normal workspace-owned item;
  Platform Admin never reconciles later definition changes into that item.

## Control-Plane Boundary Notes

- Browser paths are not upstream paths. `lib/admin-route-policy.mjs` owns the fixed mapping.
- Query parameter names are allowlisted per route before forwarding.
- `lib/admin-contract.mjs` projects successful responses before browser delivery.
- Workspace operational summaries and operational admin-audit actions are removed even if the producer returns them.
- Admin audit attribution identifies the authenticated human from immutable OIDC issuer and subject fields, with display name and email snapshots for readability. The BFF workload token remains separate credential evidence.
- Workspace creator and admin-audit object labels are optional producer fields. The BFF projects them explicitly; the browser prefers the readable label and falls back to the immutable creator or workspace ID.
- User summaries may include `lastLoginAt`, the latest recorded password or OIDC login timestamp. The BFF projects only this aggregate value and continues to exclude active-session data.
- The Admin Audit workspace field sends `workspaceQuery`, which the producer
  matches against an exact workspace ID or a case-insensitive literal workspace
  name substring. The BFF retains `workspaceId` only for compatible existing
  callers.
- The producer persists authentication lifecycle events and privileged mutation
  requests, successes, and failures. Read-only admin requests use structured
  HTTP access logs and do not create new Admin Audit records. Legacy read/search
  rows remain stored as append-only evidence but are excluded from producer
  results and defensively removed by the BFF projection.
- The mock store emits producer-shaped DTOs before the same projection is applied.
- All accepted deviations are tracked in `DESIGN.md`.

## Change Checklist

1. Compare the control-plane route, Zod schema, OpenAPI schema, and producer manifest.
2. Update both mirrored counterpart objects in the same coordinated change.
3. Update route policy, scope, query allowlist, projection, mock, frontend, and tests together.
4. Add or update the deviation ledger when the browser contract is intentionally narrower.
5. Run `npm run contracts:check`, the control-plane contract check, and the parent cross-repository contract check.

Workspace policy writes carry a unique requestId and observed expectedPolicyVersion. Identical retries reuse the exact payload and ID; a version conflict reloads policy and requires a deliberate new submission. Plan changes preserve overrides and default to rejecting over-limit usage; retain_existing requires explicit confirmation. Lifecycle writes always select source=admin, with exact workspace-name confirmation and deterministic reasons. The BFF projects mutation policy and changed fields so external holds cannot be mistaken for a successful full restoration.

## Bounded admin directory reads

`GET /admin/v1/workspaces/summary` returns exact workspace and environment counts
plus at most three workspace identity/count rows under `admin:workspace:read`.
`GET /admin/v1/users/summary` returns total and verified-user counts under
`admin:user:read`. Empty catalogs return zero counts and an empty leader list;
unavailable responses must remain errors. Neither endpoint exposes target or
session records. Counts are computed on demand; this change does not add a cache.

Workspace search matches `q` against names or IDs and accepts
`lifecycleStatus=active|suspended` before pagination; both filters participate in
the cursor signature. User detail memberships include `workspaceName`
and `workspaceLifecycleStatus` for the existing workspace IDs. Workspace, user,
and membership cursors preserve database timestamp precision while display dates
retain their existing ISO format. Existing cursor strings remain accepted.

Deploy the control-plane producer before the console consumer; roll back the
consumer first. Existing list routes and membership mutation payloads are
unchanged. No schema migration or additional scope is required.
