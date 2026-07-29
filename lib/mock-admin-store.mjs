import { ALLOWED_ADMIN_SCOPES } from "./admin-contract.mjs";
import { randomUUID } from "node:crypto";

const PLAN_CATALOG = Object.freeze({
  starter: { key: "starter", name: "Starter", quotas: { members: 5, kubernetesClusters: 3, virtualMachines: 1 } },
  team: { key: "team", name: "Team", quotas: { members: 15, kubernetesClusters: 10, virtualMachines: 5 } },
  enterprise: { key: "enterprise", name: "Enterprise", quotas: { members: 50, kubernetesClusters: 40, virtualMachines: 10 } }
});

export function createMockAdminStore() {
  let eventSequence = 100;
  const workspaces = [
    workspace("ws_atlas", "Atlas Research", "enterprise", "Enterprise", "usr_maya", "2025-08-11T08:42:00Z", 3, 7, 2, PLAN_CATALOG.enterprise.quotas),
    workspace("ws_cedar", "Cedar Systems", "team", "Team", "usr_jules", "2025-11-03T10:20:00Z", 2, 3, 1, PLAN_CATALOG.team.quotas),
    workspace("ws_lumen", "Lumen Cooperative", "team", "Team", "usr_sam", "2026-01-19T02:12:00Z", 1, 2, 0, PLAN_CATALOG.team.quotas),
    workspace("ws_northstar", "Northstar Labs", "starter", "Starter", "usr_noor", "2026-03-08T06:29:00Z", 1, 1, 0, PLAN_CATALOG.starter.quotas),
    workspace("ws_orbit", "Orbit Fieldworks", "team", "Team", "usr_arin", "2025-06-21T09:55:00Z", 1, 4, 2, PLAN_CATALOG.team.quotas)
  ];

  const users = [
    user("usr_maya", "maya@atlas.example", "Maya Chen", "2025-08-11T08:40:00Z", true, ["oidc"], 2),
    user("usr_jules", "jules@cedar.example", "Jules Okafor", "2025-11-03T10:18:00Z", true, ["password", "oidc"], 2),
    user("usr_noor", "noor@northstar.example", "Noor Rahman", "2026-03-08T06:25:00Z", true, ["oidc"], 1),
    user("usr_arin", "arin@orbit.example", "Arin Silva", "2025-06-21T09:51:00Z", true, ["password"], 1),
    user("usr_sam", "sam@lumen.example", "Sam Rivera", "2026-02-03T13:04:00Z", false, ["password"], 1),
    user("usr_ivy", "ivy@atlas.example", "Ivy Tan", "2025-09-17T11:32:00Z", true, ["oidc"], 2)
  ];
  for (const item of workspaces) {
    const creator = users.find((candidate) => candidate.id === item.createdBy);
    if (creator) {
      item.createdByDisplayName = creator.displayName;
      item.createdByEmail = creator.email;
    }
  }

  const details = new Map([
    ["usr_maya", detail(users[0], [membership("ws_atlas", users[0], "owner", "oidc", "2025-08-11T08:42:00Z")])],
    ["usr_jules", detail(users[1], [membership("ws_cedar", users[1], "owner"), membership("ws_atlas", users[1], "member")])],
    ["usr_noor", detail(users[2], [membership("ws_northstar", users[2], "owner")])],
    ["usr_arin", detail(users[3], [membership("ws_orbit", users[3], "owner")])],
    ["usr_sam", detail(users[4], [membership("ws_lumen", users[4], "member")])],
    ["usr_ivy", detail(users[5], [membership("ws_atlas", users[5], "admin"), membership("ws_cedar", users[5], "member")])]
  ]);
  for (const summary of users) summary.workspaceMembershipCount = details.get(summary.id)?.memberships.length || 0;

  const auditEvents = [
    audit("admin.workspace.detail.read", "ws_lumen", null, null, "Workspace details reviewed", "2026-07-16T01:44:00Z"),
    audit("admin.workspace.plan.update", "ws_cedar", null, null, "Approved plan change", "2026-07-14T14:03:00Z", { correlationId: "5d6f8391-6f96-4d47-a8b2-5902f3f091ad" }),
    audit("admin.member.role.update", "ws_atlas", "user", "usr_ivy", "Owner-approved role change", "2026-07-13T05:31:00Z", { previousRole: "member", nextRole: "admin", correlationId: "7c2f8391-6f96-4d47-a8b2-5902f3f091ad" })
  ];
  const aiDefault = {
    defaultProvider: "openai",
    defaultModel: "gpt-5.5",
    providerModels: {
      openai: ["gpt-5.5", "gpt-5.4", "gpt-5-mini"],
      anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5"],
      gemini: ["gemini-3.1-pro", "gemini-2.5-flash"]
    },
    reasoningSummariesEnabled: true,
    reasoningSummaryModes: ["off", "auto", "concise"],
    reasoningEfforts: ["off", "low", "medium", "high"]
  };
  const platformSettings = new Map([
    ["member_discovery", setting("member_discovery", { mode: "exact_email" }, {
      allowedModes: ["disabled", "exact_email", "directory"]
    })],
    ["ai_policy", setting("ai_policy", aiDefault, {
      providerModels: aiDefault.providerModels,
      reasoningSummariesEnabled: true,
      reasoningSummaryModes: aiDefault.reasoningSummaryModes,
      reasoningEfforts: aiDefault.reasoningEfforts
    })],
    ["user_sign_in_methods", setting("user_sign_in_methods", { methods: ["password", "oidc"] }, {
      allowedMethods: ["password", "oidc"],
      methodBlockers: { password: [], oidc: [] }
    })]
  ]);
  const llmProviderDefaults = new Map([
    ["openai", { provider: "openai", configured: true, enabled: true, source: "platform_default" }],
    ["anthropic", { provider: "anthropic", configured: false, enabled: true, source: "none" }],
    ["gemini", { provider: "gemini", configured: false, enabled: true, source: "none" }]
  ]);

  function execute(method, path, body = {}, query = new URLSearchParams()) {
    if (method === "GET" && path === "/me") return ok({ tokenId: "admin_token_local", tokenName: "Local platform admin", scopes: ALLOWED_ADMIN_SCOPES, adminApiEnabled: true, actor: { issuer: "https://idp.example.test/realms/acornops", subject: "mock-platform-admin", email: "admin@example.test", displayName: "Local Platform Admin", roles: ["platform-admin"], scopes: ALLOWED_ADMIN_SCOPES, authenticatedAt: "2026-07-17T00:00:00.000Z" } });
    if (method === "GET" && path === "/system/readiness") return ok({ status: "ok", dependencies: { postgres: "ok", redis: "ok", executionEngine: "configured", llmGateway: "configured", migrations: "checked_on_startup", runEventPersistence: "enabled", jwksSigningConfig: "present", adminAuditWrite: "configured" }, warnings: [] });
    if (method === "GET" && path === "/system/config") return ok({ adminApiEnabled: true, planCatalog: { defaultPlanKey: "starter", plans: Object.values(PLAN_CATALOG) }, roleTemplateKeys: ["owner", "admin", "member", "auditor"], authModes: { password: true, oidcProvider: "Development OIDC" }, retention: { workspaceAuditDays: 365 } });
    if (method === "GET" && path === "/settings") {
      return ok({ items: [...platformSettings.values()].map((value) => structuredClone(value)) });
    }
    if (method === "GET" && path === "/llm-provider-defaults") {
      return ok({ providers: [...llmProviderDefaults.values()].map((value) => structuredClone(value)) });
    }
    if (method === "GET" && path === "/workspaces") return ok(page(filterWorkspaces(query), query));
    if (method === "GET" && path === "/users") return ok(page(filterUsers(query), query));
    if (method === "GET" && path === "/admin-audit-events") return ok(page(filterAuditEvents(auditEvents, query), query));

    let match = /^\/workspaces\/([^/]+)$/.exec(path);
    if (method === "GET" && match) return entity(workspaces, match[1], "Workspace");
    match = /^\/users\/([^/]+)$/.exec(path);
    if (method === "GET" && match) return details.has(match[1]) ? ok(details.get(match[1])) : notFound("User");
    match = /^\/settings\/(member_discovery|ai_policy|user_sign_in_methods)$/.exec(path);
    if (match && (method === "PATCH" || method === "DELETE")) {
      const current = platformSettings.get(match[1]);
      const error = validateReason(body);
      if (error) return validation(error);
      if (body.expectedVersion !== current.version) return conflict("VERSION_CONFLICT", "Platform setting was changed by another administrator");
      current.version += 1;
      current.updatedBy = "mock-platform-admin";
      current.updatedAt = new Date().toISOString();
      if (method === "DELETE") {
        delete current.overrideValue;
        current.value = structuredClone(current.deploymentDefault);
        current.source = "deployment_default";
        record("admin.system.setting.reset", null, "platform_setting", match[1], body, { settingKey: match[1], version: current.version });
      } else {
        current.overrideValue = structuredClone(body.value);
        current.value = structuredClone(body.value);
        current.source = "runtime_override";
        record("admin.system.setting.update", null, "platform_setting", match[1], body, { settingKey: match[1], version: current.version });
      }
      return ok(structuredClone(current));
    }
    match = /^\/llm-provider-defaults\/(openai|anthropic|gemini)$/.exec(path);
    if (match && (method === "PUT" || method === "DELETE")) {
      const error = validateReason(body);
      if (error) return validation(error);
      if (method === "PUT" && (typeof body.apiKey !== "string" || !body.apiKey.trim())) {
        return validation("apiKey is required");
      }
      const current = llmProviderDefaults.get(match[1]);
      current.configured = method === "PUT";
      current.source = method === "PUT" ? "platform_default" : "none";
      record(
        method === "PUT" ? "admin.system.llm_provider_default.update" : "admin.system.llm_provider_default.delete",
        null,
        "llm_provider",
        match[1],
        { reason: body.reason },
        { provider: match[1], configured: current.configured }
      );
      return ok({ providers: [...llmProviderDefaults.values()].map((value) => structuredClone(value)) });
    }

    match = /^\/workspaces\/([^/]+)\/plan$/.exec(path);
    if (method === "PATCH" && match) {
      const target = find(workspaces, match[1]);
      if (!target) return notFound("Workspace");
      const error = validateReason(body) || (!body.planKey ? "planKey is required" : null);
      if (error) return validation(error);
      const plan = PLAN_CATALOG[body.planKey];
      if (!plan) return validation("Workspace plan is not configured");
      const targetLimits = effectiveLimits(plan.key);
      const overLimit = quotaFlags(target, targetLimits);
      if (Object.values(overLimit).some(Boolean)) return validation("Current workspace usage exceeds target plan limits");
      const before = structuredClone(target);
      target.plan = { key: plan.key, name: plan.name };
      applyLimits(target, targetLimits);
      record("admin.workspace.plan.update", target.id, null, null, body, { beforePlan: before.plan.key, afterPlan: target.plan.key });
      return ok({ before, after: structuredClone(target), usage: quotaCounts(target), overLimit });
    }

    match = /^\/workspaces\/([^/]+)\/suspend$/.exec(path);
    if (method === "POST" && match) {
      const target = find(workspaces, match[1]);
      if (!target) return notFound("Workspace");
      const error = validateReason(body);
      if (error) return validation(error);
      if (body.workspaceName !== target.name) return validation("Workspace name does not match");
      if (target.lifecycleStatus === "suspended") return conflict("WORKSPACE_ALREADY_SUSPENDED", "Workspace is already suspended");
      const before = structuredClone(target);
      target.lifecycleStatus = "suspended";
      target.suspendedAt = new Date().toISOString();
      record("admin.workspace.suspend", target.id, null, null, body, { beforeStatus: "active", afterStatus: "suspended", workspaceNameConfirmed: true });
      return ok({ before, after: structuredClone(target) });
    }

    match = /^\/workspaces\/([^/]+)\/restore$/.exec(path);
    if (method === "POST" && match) {
      const target = find(workspaces, match[1]);
      if (!target) return notFound("Workspace");
      const error = validateReason(body);
      if (error) return validation(error);
      if (body.workspaceName !== target.name) return validation("Workspace name does not match");
      if (target.lifecycleStatus === "active") return conflict("WORKSPACE_ALREADY_ACTIVE", "Workspace is already active");
      const before = structuredClone(target);
      target.lifecycleStatus = "active";
      delete target.suspendedAt;
      record("admin.workspace.restore", target.id, null, null, body, { beforeStatus: "suspended", afterStatus: "active", workspaceNameConfirmed: true });
      return ok({ before, after: structuredClone(target) });
    }

    match = /^\/workspaces\/([^/]+)\/members$/.exec(path);
    if (method === "GET" && match) {
      const target = find(workspaces, match[1]);
      if (!target) return notFound("Workspace");
      const members = [...details.values()].flatMap((item) => item.memberships).filter((member) => member.workspaceId === match[1]);
      return ok(page(members, query));
    }
    if (method === "POST" && match) return addMember(match[1], body);
    match = /^\/workspaces\/([^/]+)\/members\/([^/]+)\/role$/.exec(path);
    if (method === "PATCH" && match) return changeRole(match[1], match[2], body);
    match = /^\/workspaces\/([^/]+)\/members\/([^/]+)$/.exec(path);
    if (method === "DELETE" && match) return removeMember(match[1], match[2], body);
    return notFound("Route");
  }

  function filterWorkspaces(query) {
    const q = String(query.get("q") || "").toLowerCase();
    const planKey = query.get("planKey");
    const overLimit = query.get("overLimit");
    return workspaces.filter((item) => {
      const itemOverLimit = Object.values(item.quota).some((quota) => quota.used > quota.limit);
      return (!q || item.name.toLowerCase().includes(q)) &&
        (!planKey || item.plan.key === planKey) &&
        (overLimit === null || itemOverLimit === (overLimit === "true"));
    });
  }

  function filterUsers(query) {
    const q = String(query.get("q") || "").toLowerCase();
    const email = String(query.get("email") || "").toLowerCase();
    const authMethod = query.get("authMethod");
    const emailVerified = query.get("emailVerified");
    return users.filter((item) =>
      (!q || [item.id, item.email, item.displayName].some((value) => value.toLowerCase().includes(q))) &&
      (!email || item.email.toLowerCase() === email) &&
      (!authMethod || item.authMethods.includes(authMethod)) &&
      (emailVerified === null || item.emailVerified === (emailVerified === "true"))
    );
  }

  function changeRole(workspaceId, userId, body) {
    const userDetail = details.get(userId);
    const current = userDetail?.memberships.find((item) => item.workspaceId === workspaceId);
    const error = validateReason(body);
    if (error) return validation(error);
    if (!current) return notFound("Membership");
    const previousRole = current.role;
    if (previousRole === "owner" && body.role !== "owner" && workspaceOwnerCount(workspaceId) === 1) return conflict("LAST_OWNER", "Workspace must keep at least one owner");
    current.role = body.role;
    current.updatedAt = new Date().toISOString();
    record("admin.workspace.member.role.update", workspaceId, "user", userId, body, { previousRole, nextRole: current.role });
    return ok(current);
  }

  function addMember(workspaceId, body) {
    const target = find(workspaces, workspaceId);
    const userDetail = details.get(body.userId);
    const summary = find(users, body.userId);
    const error = validateReason(body);
    if (error) return validation(error);
    if (body.createUserIfMissing !== false) return validation("createUserIfMissing must be false");
    if (!target) return notFound("Workspace");
    if (!userDetail || !summary) return notFound("User");
    if (!["owner", "admin", "member", "auditor"].includes(body.role)) return validation("Workspace role is not configured");
    if (userDetail.memberships.some((item) => item.workspaceId === workspaceId)) return conflict("MEMBERSHIP_EXISTS", "User already has access to this workspace");
    if (target.quota.members.used >= target.quota.members.limit) return conflict("QUOTA_EXCEEDED", "Workspace member quota has been reached");

    const created = membership(workspaceId, summary, body.role, "internal", new Date().toISOString());
    userDetail.memberships.push(created);
    summary.workspaceMembershipCount += 1;
    target.memberCount += 1;
    target.quota.members.used += 1;
    record("admin.workspace.member.add", workspaceId, "user", body.userId, body, { requestedRole: body.role });
    return ok(created, 201);
  }

  function removeMember(workspaceId, userId, body) {
    const userDetail = details.get(userId);
    const index = userDetail?.memberships.findIndex((item) => item.workspaceId === workspaceId) ?? -1;
    const error = validateReason(body);
    if (error) return validation(error);
    if (index < 0) return notFound("Membership");
    const removed = userDetail.memberships[index];
    if (removed.role === "owner" && workspaceOwnerCount(workspaceId) === 1 && !body.replacementOwnerUserId) return conflict("LAST_OWNER", "A replacement owner is required");
    userDetail.memberships.splice(index, 1);
    const userSummary = find(users, userId);
    userSummary.workspaceMembershipCount = Math.max(0, userSummary.workspaceMembershipCount - 1);
    const target = find(workspaces, workspaceId);
    target.memberCount = Math.max(0, target.memberCount - 1);
    target.quota.members.used = Math.max(0, target.quota.members.used - 1);
    record("admin.workspace.member.delete", workspaceId, "user", userId, body, { replacementOwnerUserId: body.replacementOwnerUserId || null });
    return { status: 204, body: null };
  }

  function workspaceOwnerCount(workspaceId) {
    return [...details.values()].filter((item) => item.memberships.some((member) => member.workspaceId === workspaceId && member.role === "owner")).length;
  }

  function record(action, workspaceId, subjectType, subjectId, body, metadata) {
    auditEvents.unshift(audit(action, workspaceId, subjectType, subjectId, body.reason, new Date().toISOString(), { ...metadata, correlationId: randomUUID() }));
  }

  function audit(action, workspaceId, subjectType, subjectId, reason, occurredAt, metadata = {}) {
    eventSequence += 1;
    return {
      id: `00000000-0000-4000-8000-${String(eventSequence).padStart(12, "0")}`,
      adminTokenId: "admin_token_local",
      adminActorIssuer: "https://idp.example.test/realms/acornops",
      adminActorSubject: "mock-platform-admin",
      adminActorEmail: "admin@example.test",
      adminActorDisplayName: "Local Platform Admin",
      adminActorRole: "platform-admin",
      authenticationTime: occurredAt,
      action,
      outcome: "success",
      ...(workspaceId ? { workspaceId } : {}),
      ...(workspaceId && find(workspaces, workspaceId) ? { workspaceName: find(workspaces, workspaceId).name } : {}),
      ...(subjectType ? { subjectType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(reason ? { reason } : {}),
      requestId: `req_${eventSequence}`,
      metadata,
      occurredAt
    };
  }

  return { execute };
}

function workspace(id, name, planKey, planName, createdBy, createdAt, members, kubernetesClusters, virtualMachines, limits) {
  return { id, name, plan: { key: planKey, name: planName }, createdBy, createdAt, clusterCount: kubernetesClusters, virtualMachineCount: virtualMachines, memberCount: members, lifecycleStatus: "active", quota: { members: { used: members, limit: limits.members }, kubernetesClusters: { used: kubernetesClusters, limit: limits.kubernetesClusters }, virtualMachines: { used: virtualMachines, limit: limits.virtualMachines } } };
}
function user(id, email, displayName, createdAt, emailVerified, authMethods, workspaceMembershipCount) { return { id, email, displayName, createdAt, emailVerified, authMethods, workspaceMembershipCount }; }
function setting(key, deploymentDefault, constraints) {
  return {
    key,
    value: structuredClone(deploymentDefault),
    deploymentDefault: structuredClone(deploymentDefault),
    source: "deployment_default",
    version: 0,
    editable: true,
    constraints: structuredClone(constraints)
  };
}
function detail(summary, memberships) { return { user: { id: summary.id, email: summary.email, displayName: summary.displayName, createdAt: summary.createdAt, emailVerified: summary.emailVerified }, authMethods: summary.authMethods.map((type) => ({ type })), memberships }; }
function membership(workspaceId, summary, role, source = "internal", createdAt = "2026-01-01T00:00:00Z") { return { workspaceId, userId: summary.id, email: summary.email, displayName: summary.displayName, role, source, createdAt, updatedAt: createdAt }; }
function quotaCounts(item) { return { members: item.quota.members.used, kubernetesClusters: item.quota.kubernetesClusters.used, virtualMachines: item.quota.virtualMachines.used }; }
function effectiveLimits(planKey) { const plan = PLAN_CATALOG[planKey]; return { ...plan.quotas }; }
function applyLimits(item, limits = effectiveLimits(item.plan.key)) { for (const key of ["members", "kubernetesClusters", "virtualMachines"]) item.quota[key].limit = limits[key]; }
function quotaFlags(item, limits) { return Object.fromEntries(["members", "kubernetesClusters", "virtualMachines"].map((key) => [key, item.quota[key].used > limits[key]])); }
function validateReason(body) { return typeof body.reason !== "string" || body.reason.trim().length < 3 ? "reason must contain at least 3 characters" : null; }
function page(items, query = new URLSearchParams()) {
  const requestedLimit = Number(query.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 100) : Math.max(items.length, 1);
  const cursorMatch = /^mock:(\d+)$/.exec(String(query.get("cursor") || ""));
  const offset = cursorMatch ? Number(cursorMatch[1]) : 0;
  const end = Math.min(offset + limit, items.length);
  return { items: items.slice(offset, end), ...(end < items.length ? { nextCursor: `mock:${end}` } : {}) };
}
function filterAuditEvents(items, query) {
  const actionGroups = {
    workspace_access_modified: new Set(["admin.workspace.member.add", "admin.workspace.member.delete", "admin.workspace.member.role.update", "admin.member.role.update"]),
    workspace_status_modified: new Set(["admin.workspace.suspend", "admin.workspace.restore"])
  };
  return items.filter((event) => {
    if (query.get("action") && event.action !== query.get("action")) return false;
    if (query.get("actionGroup") && !actionGroups[query.get("actionGroup")]?.has(event.action)) return false;
    if (query.get("workspaceId") && event.workspaceId !== query.get("workspaceId")) return false;
    if (query.get("adminActorSubject") && event.adminActorSubject !== query.get("adminActorSubject")) return false;
    if (query.get("outcome") && event.outcome !== query.get("outcome")) return false;
    if (query.get("from") && new Date(event.occurredAt) < new Date(query.get("from"))) return false;
    if (query.get("to") && new Date(event.occurredAt) > new Date(query.get("to"))) return false;
    return true;
  });
}
function find(items, id) { return items.find((item) => item.id === id); }
function entity(items, id, type) { const item = find(items, id); return item ? ok(item) : notFound(type); }
function ok(body, status = 200) { return { status, body }; }
function validation(message) { return { status: 400, body: { error: { code: "VALIDATION_ERROR", message, retryable: false } } }; }
function notFound(type) { return { status: 404, body: { error: { code: "NOT_FOUND", message: `${type} not found`, retryable: false } } }; }
function conflict(code, message) { return { status: 409, body: { error: { code, message, retryable: false } } }; }
