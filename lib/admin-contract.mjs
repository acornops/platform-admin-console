export const ALLOWED_ADMIN_SCOPES = Object.freeze([
  "admin:self",
  "admin:system:read",
  "admin:system:write",
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
const allowedAuditPrefixes = ["admin.system.", "admin.workspace.", "admin.user.", "admin.member."];
const deniedAuditPrefixes = ["admin.user.sessions."];
const allowedAuditMetadata = new Set([
  "requestedAction", "beforePlan", "requestedPlan", "afterPlan", "beforeRole", "previousRole",
  "requestedRole", "nextRole", "replacementOwnerUserId",
  "usage", "targetLimits", "overLimit", "before", "requested", "after",
  "beforeStatus", "afterStatus", "requestedStatus", "stateConflict", "workspaceNameConfirmed", "confirmationMatched",
  "settingKey", "previousVersion", "version", "provider", "configured", "correlationId"
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
  if (template === "/admin/v1/system/settings") {
    return { items: array(payload?.items).map(projectPlatformSetting) };
  }
  if (template === "/admin/v1/system/settings/:settingKey") return projectPlatformSetting(payload);
  if (template === "/admin/v1/system/llm-provider-defaults" || template === "/admin/v1/system/llm-provider-defaults/:provider") {
    return { providers: array(payload?.providers).map(projectLlmProviderDefaultStatus) };
  }
  if (template === "/admin/v1/system/workspace-defaults") {
    return definition.method === "GET"
      ? { items: array(payload?.items).map(projectWorkspaceDefault) }
      : projectWorkspaceDefault(payload);
  }
  if (template === "/admin/v1/system/workspace-defaults/:id") {
    return payload ? projectWorkspaceDefault(payload) : null;
  }
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

function projectWorkspaceDefault(value = {}) {
  const kind = value.kind === "skill" ? "skill" : "mcp_server";
  const availableIn = projectWorkspaceDefaultAvailability(value.availableIn);
  const source = kind === "mcp_server"
    ? { type: "https", endpoint: string(value.source?.endpoint) }
    : value.source?.type === "manual"
      ? { type: "manual" }
      : {
        type: "git",
        provider: value.source?.provider === "gitlab" ? "gitlab" : "github",
        repoUrl: string(value.source?.repoUrl),
        ref: string(value.source?.ref),
        ...(value.source?.subpath ? { subpath: string(value.source.subpath) } : {}),
        commitSha: string(value.source?.commitSha)
      };
  return {
    id: string(value.id),
    kind,
    name: string(value.name),
    description: string(value.description),
    availableIn,
    enabled: value.enabled !== false,
    source,
    ...(value.contentDigest ? { contentDigest: string(value.contentDigest) } : {}),
    createdAt: string(value.createdAt),
    updatedAt: string(value.updatedAt)
  };
}

function projectWorkspaceDefaultAvailability(value) {
  const legacy = value === "all"
    ? ["agents", "kubernetes", "virtual_machines"]
    : typeof value === "string" ? [value] : value;
  return ["agents", "kubernetes", "virtual_machines"].filter((destination) => array(legacy).includes(destination));
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

function projectPlatformSetting(value = {}) {
  const key = ["member_discovery", "ai_policy", "user_sign_in_methods"].includes(value.key) ? value.key : "";
  const projected = {
    key,
    value: projectPlatformSettingValue(key, value.value),
    deploymentDefault: projectPlatformSettingValue(key, value.deploymentDefault),
    source: ["deployment_default", "runtime_override", "runtime_override_constrained"].includes(value.source)
      ? value.source
      : "deployment_default",
    version: number(value.version),
    editable: Boolean(value.editable),
    constraints: projectPlatformSettingConstraints(key, value.constraints)
  };
  if (value.overrideValue !== undefined) projected.overrideValue = projectPlatformSettingValue(key, value.overrideValue);
  if (value.updatedBy) projected.updatedBy = string(value.updatedBy);
  if (value.updatedAt) projected.updatedAt = string(value.updatedAt);
  if (value.warning) projected.warning = string(value.warning);
  return projected;
}

function projectLlmProviderDefaultStatus(value = {}) {
  const provider = ["openai", "anthropic", "gemini"].includes(value.provider)
    ? value.provider
    : "";
  return {
    provider,
    configured: value.configured === true,
    enabled: value.enabled === true,
    source: value.configured === true && value.source === "platform_default"
      ? "platform_default"
      : "none"
  };
}

function projectPlatformSettingValue(key, value = {}) {
  if (key === "member_discovery") {
    return { mode: ["disabled", "exact_email", "directory"].includes(value.mode) ? value.mode : "disabled" };
  }
  if (key === "user_sign_in_methods") {
    return { methods: uniqueSignInMethods(value.methods) };
  }
  if (key === "ai_policy") {
    return {
      defaultProvider: ["openai", "anthropic", "gemini"].includes(value.defaultProvider) ? value.defaultProvider : "openai",
      defaultModel: string(value.defaultModel),
      providerModels: projectProviderModels(value.providerModels),
      reasoningSummariesEnabled: value.reasoningSummariesEnabled === true,
      reasoningSummaryModes: array(value.reasoningSummaryModes).map(String),
      reasoningEfforts: array(value.reasoningEfforts).map(String)
    };
  }
  return {};
}

function projectPlatformSettingConstraints(key, value = {}) {
  if (key === "member_discovery") return { allowedModes: array(value.allowedModes).map(String) };
  if (key === "user_sign_in_methods") {
    return {
      allowedMethods: uniqueSignInMethods(value.allowedMethods),
      methodBlockers: projectSignInMethodBlockers(value.methodBlockers)
    };
  }
  if (key === "ai_policy") {
    return {
      providerModels: projectProviderModels(value.providerModels),
      reasoningSummariesEnabled: value.reasoningSummariesEnabled === true,
      reasoningSummaryModes: array(value.reasoningSummaryModes).map(String),
      reasoningEfforts: array(value.reasoningEfforts).map(String)
    };
  }
  return {};
}

function projectProviderModels(value = {}) {
  return {
    openai: array(value.openai).map(String),
    anthropic: array(value.anthropic).map(String),
    gemini: array(value.gemini).map(String)
  };
}

function uniqueSignInMethods(value) {
  return [...new Set(array(value).filter((method) => ["password", "oidc"].includes(method)))];
}

function projectSignInMethodBlockers(value = {}) {
  return Object.fromEntries(["password", "oidc"].map((method) => [
    method,
    array(value?.[method]).map(String)
  ]));
}

function projectWorkspace(value = {}) {
  return {
    id: string(value.id), name: string(value.name), plan: projectPlan(value.plan), createdBy: string(value.createdBy), createdAt: string(value.createdAt),
    ...(value.createdByDisplayName ? { createdByDisplayName: string(value.createdByDisplayName) } : {}),
    ...(value.createdByEmail ? { createdByEmail: string(value.createdByEmail) } : {}),
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
    .filter((event) => !String(event?.action || "").endsWith(".read") && !String(event?.action || "").endsWith(".search"))
    .filter((event) => !event?.targetId && !event?.targetType)
    .map((event) => ({
      ...pick(event, ["id", "adminTokenId", "adminActorIssuer", "adminActorSubject", "adminActorEmail", "adminActorDisplayName", "adminActorRole", "authenticationTime", "action", "outcome", "workspaceId", "workspaceName", "subjectType", "subjectId", "subjectDisplayName", "reason", "requestId", "occurredAt"]),
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
