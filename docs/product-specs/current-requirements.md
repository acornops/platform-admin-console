# Current Platform Admin Console Requirements

Status: production authorization baseline
Last reviewed: 2026-07-29
Machine evidence: [`requirements-baseline.json`](requirements-baseline.json)

## Authority And Change Protocol

This document is the current product baseline for this repository. `PRODUCT.md`, `ARCHITECTURE.md`, `DESIGN.md`, the contract manifest, and this document are normative together. Completed execution plans are historical evidence, not current requirements; when a later accepted change contradicts an earlier plan, this baseline and the latest design register win.

Before implementing a new prompt:

1. Read this document and `DESIGN.md`.
2. Classify the request as preserving, replacing, adding, or unblocking a requirement.
3. Do not revive an `EXC-*` behavior. If the user intentionally reverses a decision, update this document, `requirements-baseline.json`, tests, and relevant design or contract records in the same change.
4. Do not implement a `BLOCK-*` capability until its prerequisite `/admin/v1` contract and security controls exist.
5. Run `npm run requirements:check` during development and `npm run validate` before handoff.

The executable baseline may use current source, durable docs, contracts, and focused tests as evidence. It must never use a completed execution plan as current evidence.

## Required Baseline

### Boundary and authorization

| ID | Requirement |
| --- | --- |
| `REQ-BND-001` | The browser sends governance API calls only to same-origin `/admin-console-api/*`; the BFF maps those calls to a fixed `/admin/v1` allowlist and never accepts an arbitrary upstream path. The dedicated same-origin authentication flow is limited to the declared `/admin-auth/*` routes. |
| `REQ-BND-002` | Platform admins receive governance metadata only. Tenant logs, audit records, targets, agents, sessions, runs, prompts, tools, workspace credentials, commands, and workload changes remain unavailable. The only credential operation is the explicit write-only platform-default LLM key capability in `REQ-SET-002`; key values are never returned. |
| `REQ-BND-003` | The consumer credential rejects `admin:*` and operational scopes. Responses are privacy-projected and fail closed before reaching the browser. |
| `REQ-AUTH-001` | Production access uses a dedicated platform-admin OIDC client with PKCE, MFA assurance, a host-only one-hour admin session, CSRF protection, and exactly three roles: `platform-admin`, `platform-admin-viewer`, and `platform-admin-auditor`. The control plane requires both the internal BFF credential and the human admin session. Writes require authentication no older than 15 minutes. Password login and self-signup are absent. Identity-provider dependency failures return a stable retryable response and render a no-store sign-in-unavailable page with request correlation rather than raw internal error details. |

### Shared visual language

| ID | Requirement |
| --- | --- |
| `REQ-UX-001` | Reuse the management console's shell, typography, control structure, and interaction vocabulary. Retain the shield-labelled Platform Admin identity, the concise `Admin · AcornOps` browser title, and a noticeable but restrained cream-clay sidebar tint. Overview remains the standalone first destination. `Admin Management` groups Workspaces, Users, and Platform Settings; `Governance` contains Admin Audit. The existing `/`, `/workspaces`, `/users`, `/settings`, and `/audit` routes remain unchanged. The bottom administrator identity is a management-aligned account-menu trigger showing the authenticated human's display name or email and current platform role. Its popover repeats the identity, offers System, Light, and Dark appearance preferences, and provides the explicit logout action. Account settings remain absent because platform-admin identity and credentials are IdP-managed and the console has no local account mutation contract. The former sidebar tenant-boundary card is removed; Overview's `Governance data only` banner carries the lock icon and confidentiality reminder. |
| `REQ-CTL-001` | Dropdowns follow the management console's trigger, menu, option, checkmark, and scrollbar design. Open chevrons rotate but remain grey; the workspace filter uses a themed clear control. |

### Platform settings

| ID | Requirement |
| --- | --- |
| `REQ-SET-001` | Platform Settings follows the management console's Workspace Settings structure with a compact underline tab strip and independently titled setting sections above quiet bordered control surfaces. It provides two accessible top-level categories: `Workspace`, containing Member Discovery and a multi-select User Sign-In Methods checklist, and `AI`, containing Default LLM Keys followed by AI Policy. User Sign-In Methods controls workspace-user authentication only; Platform Admin remains OIDC-only. Password allows password login and prompts first-time users to create a password, while OIDC redirects users to the configured provider. One or both methods may be enabled, but at least one must remain selected and deployment-disabled methods are shown with their blocker and cannot be selected. Member Discovery makes the addition outcome clear: Directory and Exact Email add an existing user directly to the workspace, while By Invites Only requires the invited person to accept before they are added. The full `platform-admin` role may save or reset versioned runtime overrides through fixed `/admin/v1/system/settings` contracts; its Save button remains disabled until a valid value differs from the current effective setting. Viewers remain read-only and auditors have no settings route. The page shows the effective value, deployment boundary, source, policy blockers, and concise mutation feedback without exposing secrets or accepting arbitrary setting keys. |
| `REQ-SET-002` | The `AI` category in Platform Settings exposes Default LLM Keys before AI Policy, with separate provider cards and green configured-status badges for write-only OpenAI, Anthropic, and Gemini keys through fixed `/admin/v1/system/llm-provider-defaults` routes. Key inputs and Save key, Rotate key, and Delete key actions reuse the management-console field and button vocabulary; Save key and Rotate key share the same outlined treatment and remain disabled until a non-empty key is entered. A full `platform-admin` may save, rotate, or explicitly confirm deletion; viewers see status only and auditors have no settings route. Keys are encrypted by the gateway secret backend, never returned, logged, stored in browser storage, or included in audit metadata. Workspaces use a default unless they save an exact workspace override. |

### Overview

| ID | Requirement |
| --- | --- |
| `REQ-OVR-001` | The Overview serves a platform product manager with a brief, governance-safe portfolio view assembled by exhausting the existing workspace and user cursors. It summarizes workspace and user totals plus connected Kubernetes and VM environments without a generic readiness-status badge. `Most connected environments` ranks the three largest workspace footprints, with unadorned workspace links, a per-row total and Kubernetes-cluster/VM breakdown, and no doubled divider before the first row. Product Signals is limited to three items: explicit suspended-workspace count, identity verification follow-up, and connected-environment concentration; it has no subtitle. Access-assignment totals, plan adoption, users-with-access rankings, and privileged-event totals remain absent. The overview must not imply workload, run, command, target, session, or tenant-audit usage. |

### Users and workspace access

| ID | Requirement |
| --- | --- |
| `REQ-USR-001` | The Users directory uses the accepted description, management-aligned search, verification filtering, free-text workspace suggestions, `Showing X of Y`, and cursor-driven `Load more`. |
| `REQ-USR-002` | Selecting a user opens an accessible right-side panel while preserving the directory context and deep-linkable user route. |
| `REQ-USR-003` | The panel header shows name and email. `User Details` contains internal identity metadata; alphabetized `Workspace Access` contains the user's existing memberships without source/origin explanations. |
| `REQ-USR-004` | Role options come only from `roleTemplateKeys`. `Update Role` stays visible, is disabled until changed, and applies immediately with a system-generated reason and concise success toast. |
| `REQ-USR-005` | Each access record has a persistent light-danger revoke icon beside Update Role. Owner access is safeguarded and the confirmation copy describes workspace access only. |
| `REQ-USR-006` | Workspace access is revoked one membership at a time. The console does not expose a client-orchestrated all-workspace offboarding action because the producer has no atomic preview-and-mutation contract. |
| `REQ-USR-007` | Successful revocations immediately synchronize the panel count, directory workspace count, and active workspace-filter result set. |
| `REQ-USR-008` | Verification remains text plus a dot. Verified is green; Unverified is readable orange without a bubble, and all dots align through one fixed grid. |
| `REQ-USR-009` | The selected-user panel provides `Grant Access`. It lists only workspaces the user does not already access, uses only contract-provided roles, sends the existing `userId` with `createUserIfMissing: false`, records a deterministic audit reason, and synchronizes panel and directory counts after success. |

### Workspaces

| ID | Requirement |
| --- | --- |
| `REQ-WSP-001` | The Workspaces directory follows the Users inventory pattern with the accepted description, workspace-name search, a management-aligned All statuses/Active/Suspended dropdown, a loaded-result count, cursor-driven `Load more`, and an Active/Suspended status column. Because the producer has no lifecycle-status query, selecting a status exhausts the existing filtered workspace cursor and applies the status locally across the complete result set; unfiltered browsing remains cursor-driven. Plan details and plan filters remain out of the directory. |
| `REQ-WSP-002` | Selecting a workspace keeps the directory visible and opens an accessible, deep-linkable right-side panel. The workspace directory and `Workspace Details` show the creator using recorded display name, email, and immutable user ID as fallbacks. `Workspace Details` shows Kubernetes connections, virtual-machine connections, current plan, creator, and creation date in that order. Kubernetes and VM values render as neutral connected/plan-limit counters derived from the existing plan catalog, reserving red for over-limit exceptions, and `Change Plan` sits directly beside the current plan value. The console exposes no quota policy, quota usage row, quota override, or separate Manage Workspace section. |
| `REQ-WSP-003` | `Workspace Access` merges the member count with a progressively loaded read-only table from the authoritative paginated `/admin/v1/workspaces/{workspaceId}/members` read. Members are grouped by descending role privilege—Owner, Admin, Member, then remaining roles—and alphabetized within a role tier. `Manage Access` deliberately switches this section into workspace-scoped management without leaving the panel. A compact person-plus action beside `Done` grants an existing user access with `createUserIfMissing: false` and an accessible tooltip. Rows can update roles or revoke individual access while the sole displayed Owner remains disabled; when multiple Owners are present, any one may be changed or revoked because another Owner remains. The producer's `LAST_OWNER` response remains authoritative if membership changes concurrently. Bulk workspace revocation is not exposed here. The Users panel remains the user-scoped way to manage one identity across workspaces. |
| `REQ-WSP-004` | Workspace lifecycle shows the producer-backed active or suspended state in a prominent panel badge and the workspace directory status column. Suspension and restoration both require an exact workspace-name confirmation and supply a deterministic mutation reason without asking for a reason or ticket reference. Suspension blocks ordinary member access without deleting memberships or modifying workloads; restoration re-enables access using retained memberships. The dialog Cancel action always closes without being blocked by confirmation-field validation. |

### Audit

| ID | Requirement |
| --- | --- |
| `REQ-AUD-002` | Production audit attribution identifies the authenticated human by immutable OIDC issuer and subject, with display-name/email and role snapshots for readability. The BFF service credential remains separate evidence. Human-actor filters use `adminActorSubject`; source-IP hashes, user agents, session hashes, and unrestricted metadata remain protected from browser delivery. This production requirement supersedes the prototype-only credential-attribution sentence in `REQ-AUD-001`. |
| `REQ-AUD-001` | Admin Audit follows the workspace audit-log structure with responsive Time, Event, Actor, Object, and Details columns. The Actor column shows one human-readable administrator name only, using recorded display name with email and immutable subject as fallbacks; role and credential evidence remain available in protected details rather than adding a second table line. The Details action uses the same Eye icon as the workspace audit log. Outcome is removed from the permanent table but remains available as a filter and in event details. Governance-safe filters cover event, workspace ID, human admin actor, outcome, Today, Last 24h, Past 7d, Past 30d, and a custom date-time range using only the producer's allowlisted query fields. Known action codes use concise labels while the code and outcome remain secondary context: grants and revocations display `Modified workspace access`, role changes display `Updated member role`, and suspension and restoration display `Modified workspace status`. One `Modified workspace access` filter covers all three operations through a fixed producer `actionGroup`. Object displays the recorded workspace name with immutable `workspaceId` as fallback, followed by the affected subject; the ID remains available in projected event details and as the workspace filter value. The compact details panel contains Time, Event type, Outcome, Actor, Object, Correlation ID, and every governance-safe projected field. `Safe metadata`, ticket references, source-IP hashes, user agents, session hashes, and unrestricted metadata remain absent. Missing correlation is labelled `Not applicable`. Events retain the management-console append-only 50-record cursor pattern, automatic near-boundary loading, and a `Load more` fallback. |

## Superseded And Excluded Behavior

These decisions are deliberate exclusions from the current console and from future implementation assumptions.

| ID | Excluded behavior |
| --- | --- |
| `EXC-001` | Session revocation routes, controls, or audit families. |
| `EXC-002` | User-account creation, email-based user resolution, `createUserIfMissing: true`, access recovery, or recovery-desk UI. Granting an existing user workspace access with `createUserIfMissing: false` is explicitly allowed. |
| `EXC-003` | Treating `suspend` as a role or describing membership deletion as suspension. |
| `EXC-004` | Replacing the Users directory with a full detail page and a small `Back to all users` action. |
| `EXC-005` | The removed Privileged governance banner, category eyebrows, prototype labels, account-directory labels, or user-registry counters. |
| `EXC-006` | `Cross-workspace` or `Workspace Membership` product wording; use Workspaces and Workspace Access. |
| `EXC-007` | Displaying raw membership `source` or origin explanations. |
| `EXC-008` | Displaying the internal user ID beneath the user's name in the directory table. |
| `EXC-009` | Rendering Unverified as an amber/orange pill or bubble. |
| `EXC-010` | A reason/ticket dialog for role updates; the explicit Update Role click and deterministic reason are sufficient for the current contract. |
| `EXC-011` | Role-update toast copy that mentions Admin Audit implementation details. |
| `EXC-012` | Allowing an Owner membership in one workspace to block individual revocation of unrelated workspace access. |
| `EXC-013` | Changing dropdown arrows to orange when open. |
| `EXC-014` | Browser-native datalist suggestions or native search-clear styling for the workspace filter. |
| `EXC-015` | Workspace-specific quota policy, quota-usage rows, quota override controls, or the legacy quota mutation route in the platform-admin consumer. Workspace limits are presented and managed only through the selected plan. |
| `EXC-016` | Free-form reason or ticket-reference fields in workspace suspension or restoration confirmation. Exact-name confirmation is the human safeguard; the consumer supplies the producer-required deterministic audit reason. |
| `EXC-017` | Free-form reason or ticket-reference fields in the Change Plan dialog. Selecting a plan and explicitly submitting the change is sufficient confirmation; the consumer supplies the producer-required deterministic audit reason. |
| `EXC-018` | Consumer-orchestrated sequential all-workspace revocation. It remains absent until the producer provides an atomic impact-preview and offboarding mutation contract. |

## Contract-Blocked Capabilities

These are not current features. They stay disabled or absent until the producer contract and required security behavior exist.

| ID | Blocked capability and prerequisite |
| --- | --- |
| `BLOCK-001` | Retention countdown and purge remain blocked pending dedicated governance-safe `/admin/v1` contracts. Hard deletion remains excluded. Workspace suspension and restoration are now supported separately by `REQ-WSP-004`. |
| `BLOCK-002` | Atomic ownership transfer requires a dedicated producer contract. Workspace-scoped member reads are now authoritative and paginated; the producer's last-owner invariant remains authoritative during concurrent mutations. |
| `BLOCK-003` | Reversible membership suspension requires dedicated suspend and restore contracts; it must not be encoded as a role. |
| `BLOCK-004` | Atomic all-workspace offboarding requires server-side impact preview and mutation support. No browser-orchestrated substitute is exposed in the production console. |

## Current Contract Subset

The accepted consumer subset is 21 routes and 8 least-privilege scopes, mirrored in `docs/contracts/manifest.json` and enforced by `lib/admin-route-policy.mjs` and `lib/admin-contract.mjs`. Adding an endpoint, query, scope, or payload field is a contract change, not a UI convenience; update producer and consumer artifacts together and record any necessary deviation in `DESIGN.md`.
