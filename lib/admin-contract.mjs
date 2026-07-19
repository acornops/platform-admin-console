export const ALLOWED_ADMIN_SCOPES = Object.freeze([
  "admin:self",
  "admin:system:read",
  "admin:workspace:read",
  "admin:workspace:write",
  "admin:user:read",
  "admin:member:write",
  "admin:audit:read"
]);
export const FORBIDDEN_ADMIN_SCOPES = Object.freeze([
  "admin:*",
  "admin:target:read",
  "admin:target:write",
  "admin:agent-key:rotate",
  "admin:run:read",
  "admin:run:write",
  "admin:tooling:write"
]);

const allowedScopeSet = new Set(ALLOWED_ADMIN_SCOPES);
const forbiddenScopeSet = new Set(FORBIDDEN_ADMIN_SCOPES);
const platformAdminRoleSet = new Set(["platform-admin", "platform-admin-viewer", "platform-admin-auditor"]);
const allowedAuditPrefixes = ["admin.system.", "admin.workspace.", "admin.user.", "admin.member.", "admin.admin_audit."];
const deniedAuditPrefixes = ["admin.user.sessions."];
const allowedAuditMetadata = new Set([
  "highRiskRead", "requestedAction", "beforePlan", "requestedPlan", "afterPlan", "beforeRole", "previousRole",
  "requestedRole", "nextRole", "replacementOwnerUserId",
  "usage", "targetLimits", "overLimit", "before", "requested", "after",
  "beforeStatus", "afterStatus", "requestedStatus", "stateConflict", "workspaceNameConfirmed", "confirmationMatched",
  "correlationId"
]);

export function validateAdminIdentity(payload, { requireHumanIdentity = process.env.NODE_ENV === "production" } = {}) {
  if (!payload || payload.adminApiEnabled !== true || !Array.isArray(payload.scopes)) return { ok: false, error: "admin_identity_invalid" };
  if (requireHumanIdentity && (!payload.actor || !Array.isArray(payload.actor.roles) || !payload.actor.roles.length)) return { ok: false, error: "admin_human_identity_required" };
  if (requireHumanIdentity && payload.actor.roles.some((role) => !platformAdminRoleSet.has(role))) return { ok: false, error: "admin_human_role_invalid" };
  const forbidden = payload.scopes.filter((scope) => forbiddenScopeSet.has(scope) || !allowedScopeSet.has(scope));
  return forbidden.length ? { ok: false, error: "admin_credential_has_forbidden_scopes", forbidden } : { ok: true };
}

export function projectAdminResponse(definition, payload) {
  const template = definition.upstreamTemplate;
  if (template === "/admin/v1/me") return { ...pick(payload, ["tokenId", "tokenName", "scopes", "adminApiEnabled"]), actor: projectAdminActor(payload.actor) };
  if (template === "/admin/v1/system/readiness") return pick(payload, ["status", "dependencies", "warnings"]);
  if (template === "/admin/v1/system/config") return projectConfig(payload);
  if (template === "/admin/v1/workspaces") return projectPage(payload, (value) => projectWorkspace(value, false));
  if (template === "/admin/v1/workspaces/:workspaceId") return projectWorkspace(payload, true);
  if (definition.method === "GET" && template === "/admin/v1/workspaces/:workspaceId/members") return projectPage(payload, projectMembership);
  if (template === "/admin/v1/workspaces/:workspaceId/plan") return {
    before: projectWorkspace(payload.before), after: projectWorkspace(payload.after)
  };
  if (template === "/admin/v1/workspaces/:workspaceId/suspend" || template === "/admin/v1/workspaces/:workspaceId/restore") {
    return { before: projectWorkspace(payload.before), after: projectWorkspace(payload.after) };
  }
  if (template === "/admin/v1/users") return projectPage(payload, projectUserSummary);
  if (template === "/admin/v1/users/:userId") return projectUserDetail(payload);
  if (template.includes("/members")) return projectMembership(payload);
  if (template === "/admin/v1/admin-audit-events") return projectAuditPage(payload);
  throw new Error(`No response projection for ${template}`);
}

function projectConfig(value = {}) {
  return {
    adminApiEnabled: value.adminApiEnabled === true,
    planCatalog: value.planCatalog && typeof value.planCatalog === "object" ? value.planCatalog : { plans: [] },
    roleTemplateKeys: array(value.roleTemplateKeys).map(String),
    authModes: value.authModes && typeof value.authModes === "object" ? value.authModes : {},
    retention: pick(value.retention, ["workspaceAuditDays"])
  };
}

function projectWorkspace(value = {}) {
  return {
    id: string(value.id), name: string(value.name), plan: projectPlan(value.plan), createdBy: string(value.createdBy), createdAt: string(value.createdAt),
    clusterCount: number(value.clusterCount), virtualMachineCount: number(value.virtualMachineCount), memberCount: number(value.memberCount),
    lifecycleStatus: value.lifecycleStatus === "suspended" ? "suspended" : "active",
    ...(value.suspendedAt ? { suspendedAt: string(value.suspendedAt) } : {})
  };
}

function projectPlan(value = {}) { return { key: string(value.key), name: string(value.name) }; }

function projectUserSummary(value = {}) {
  return {
    id: string(value.id), email: string(value.email), displayName: string(value.displayName), createdAt: string(value.createdAt),
    emailVerified: Boolean(value.emailVerified), authMethods: array(value.authMethods).map(String), workspaceMembershipCount: number(value.workspaceMembershipCount)
  };
}

function projectUserDetail(value = {}) {
  return {
    user: { ...pick(value.user, ["id", "email", "displayName", "createdAt"]), emailVerified: Boolean(value.user?.emailVerified) },
    authMethods: array(value.authMethods).map((method) => ({ type: string(method?.type) })),
    memberships: array(value.memberships).map(projectMembership)
  };
}

function projectMembership(value = {}) {
  return pick(value, ["workspaceId", "userId", "email", "displayName", "role", "createdAt", "updatedAt"]);
}

function projectAuditPage(value = {}) {
  const items = array(value.items)
    .filter((event) => allowedAuditPrefixes.some((prefix) => String(event?.action || "").startsWith(prefix)))
    .filter((event) => !deniedAuditPrefixes.some((prefix) => String(event?.action || "").startsWith(prefix)))
    .filter((event) => !event?.targetId && !event?.targetType)
    .map((event) => ({
      ...pick(event, ["id", "adminTokenId", "adminActorIssuer", "adminActorSubject", "adminActorEmail", "adminActorDisplayName", "adminActorRole", "authenticationTime", "action", "outcome", "workspaceId", "subjectType", "subjectId", "reason", "requestId", "occurredAt"]),
      metadata: Object.fromEntries(Object.entries(event.metadata || {}).filter(([key]) => allowedAuditMetadata.has(key)))
    }));
  return { items, ...(value.nextCursor ? { nextCursor: String(value.nextCursor) } : {}) };
}

function projectAdminActor(value = {}) {
  return pick(value, ["issuer", "subject", "email", "displayName", "roles", "scopes", "authenticatedAt"]);
}

function projectPage(value, projector) { return { items: array(value?.items).map(projector), ...(value?.nextCursor ? { nextCursor: String(value.nextCursor) } : {}) }; }
function pick(value = {}, keys) { return Object.fromEntries(keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]])); }
function array(value) { return Array.isArray(value) ? value : []; }
function string(value) { return value === undefined || value === null ? "" : String(value); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
