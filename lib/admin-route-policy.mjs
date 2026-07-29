const segment = "([^/]+)";

export const ADMIN_ROUTE_DEFINITIONS = Object.freeze([
  route("GET", "/me", "/admin/v1/me", "admin:self", "identity"),
  route("GET", "/system/readiness", "/admin/v1/system/readiness", "admin:system:read", "read"),
  route("GET", "/system/config", "/admin/v1/system/config", "admin:system:read", "read"),
  route("GET", "/settings", "/admin/v1/system/settings", "admin:system:read", "read"),
  route("PATCH", "/settings/(member_discovery|ai_policy|password_signup)", "/admin/v1/system/settings/:settingKey", "admin:system:write", "write", ["settingKey"]),
  route("DELETE", "/settings/(member_discovery|ai_policy|password_signup)", "/admin/v1/system/settings/:settingKey", "admin:system:write", "write", ["settingKey"]),
  route("GET", "/llm-provider-defaults", "/admin/v1/system/llm-provider-defaults", "admin:system:read", "read"),
  route("PUT", "/llm-provider-defaults/(openai|anthropic|gemini)", "/admin/v1/system/llm-provider-defaults/:provider", "admin:system:write", "write", ["provider"]),
  route("DELETE", "/llm-provider-defaults/(openai|anthropic|gemini)", "/admin/v1/system/llm-provider-defaults/:provider", "admin:system:write", "write", ["provider"]),
  route("GET", "/workspaces", "/admin/v1/workspaces", "admin:workspace:read", "read", [], ["q", "planKey", "createdBy", "createdAfter", "createdBefore", "overLimit", "limit", "cursor"]),
  route("GET", `/workspaces/${segment}`, "/admin/v1/workspaces/:workspaceId", "admin:workspace:read", "read", ["workspaceId"]),
  route("GET", `/workspaces/${segment}/members`, "/admin/v1/workspaces/:workspaceId/members", "admin:user:read", "read", ["workspaceId"], ["limit", "cursor"]),
  route("PATCH", `/workspaces/${segment}/plan`, "/admin/v1/workspaces/:workspaceId/plan", "admin:workspace:write", "write", ["workspaceId"]),
  route("POST", `/workspaces/${segment}/suspend`, "/admin/v1/workspaces/:workspaceId/suspend", "admin:workspace:write", "write", ["workspaceId"]),
  route("POST", `/workspaces/${segment}/restore`, "/admin/v1/workspaces/:workspaceId/restore", "admin:workspace:write", "write", ["workspaceId"]),
  route("GET", "/users", "/admin/v1/users", "admin:user:read", "read", [], ["q", "email", "authMethod", "emailVerified", "limit", "cursor"]),
  route("GET", `/users/${segment}`, "/admin/v1/users/:userId", "admin:user:read", "read", ["userId"]),
  route("POST", `/workspaces/${segment}/members`, "/admin/v1/workspaces/:workspaceId/members", "admin:member:write", "write", ["workspaceId"]),
  route("PATCH", `/workspaces/${segment}/members/${segment}/role`, "/admin/v1/workspaces/:workspaceId/members/:userId/role", "admin:member:write", "write", ["workspaceId", "userId"]),
  route("DELETE", `/workspaces/${segment}/members/${segment}`, "/admin/v1/workspaces/:workspaceId/members/:userId", "admin:member:write", "write", ["workspaceId", "userId"]),
  route("GET", "/admin-audit-events", "/admin/v1/admin-audit-events", "admin:audit:read", "audit", [], ["adminActorSubject", "action", "actionGroup", "outcome", "workspaceId", "from", "to", "limit", "cursor"])
]);

function route(method, browserPattern, upstreamTemplate, requiredScope, classification, params = [], queryParams = []) {
  return Object.freeze({
    method,
    browserPattern,
    browserRegex: new RegExp(`^${browserPattern}$`),
    upstreamTemplate,
    requiredScope,
    classification,
    params,
    queryParams
  });
}

export function sanitizedAdminQuery(definition, searchParams) {
  const sanitized = new URLSearchParams();
  for (const [name, value] of searchParams) {
    if (!definition.queryParams.includes(name)) return null;
    sanitized.append(name, value);
  }
  return sanitized;
}

export function sanitizedAdminBody(definition, body) {
  if (definition.upstreamTemplate === "/admin/v1/system/llm-provider-defaults/:provider") {
    const deleting = definition.method === "DELETE";
    const allowedFields = new Set(deleting ? ["reason"] : ["apiKey", "reason"]);
    if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((field) => !allowedFields.has(field))) {
      return { ok: false, message: "Only platform LLM provider default fields are allowed" };
    }
    if (typeof body.reason !== "string" || body.reason.trim().length < 3) {
      return { ok: false, message: "reason must contain at least 3 characters" };
    }
    if (!deleting && (typeof body.apiKey !== "string" || !body.apiKey.trim() || body.apiKey.length > 4096)) {
      return { ok: false, message: "apiKey must contain a provider key no longer than 4096 characters" };
    }
    return {
      ok: true,
      body: {
        ...(deleting ? {} : { apiKey: body.apiKey.trim() }),
        reason: body.reason.trim()
      }
    };
  }
  if (definition.upstreamTemplate === "/admin/v1/system/settings/:settingKey") {
    const resetting = definition.method === "DELETE";
    const allowedFields = new Set(resetting ? ["expectedVersion", "reason"] : ["value", "expectedVersion", "reason"]);
    if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((field) => !allowedFields.has(field))) {
      return { ok: false, message: "Only platform setting fields are allowed" };
    }
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) {
      return { ok: false, message: "expectedVersion must be a non-negative integer" };
    }
    if (typeof body.reason !== "string" || body.reason.trim().length < 3) {
      return { ok: false, message: "reason must contain at least 3 characters" };
    }
    if (!resetting && (!body.value || Array.isArray(body.value) || typeof body.value !== "object")) {
      return { ok: false, message: "value must be an object" };
    }
    return {
      ok: true,
      body: {
        ...(resetting ? {} : { value: structuredClone(body.value) }),
        expectedVersion: body.expectedVersion,
        reason: body.reason.trim()
      }
    };
  }
  const lifecycleAction = definition.upstreamTemplate.match(/^\/admin\/v1\/workspaces\/:workspaceId\/(suspend|restore)$/)?.[1];
  if (lifecycleAction) {
    const allowedFields = new Set(["workspaceName", "reason", "ticketRef"]);
    if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((field) => !allowedFields.has(field))) {
      return { ok: false, message: `Only workspace ${lifecycleAction} confirmation fields are allowed` };
    }
    if (typeof body.workspaceName !== "string" || !body.workspaceName) return { ok: false, message: "workspaceName is required" };
    if (typeof body.reason !== "string" || body.reason.trim().length < 3) return { ok: false, message: "reason must contain at least 3 characters" };
    if (body.ticketRef !== undefined && typeof body.ticketRef !== "string") return { ok: false, message: "ticketRef must be a string" };
    return { ok: true, body: { workspaceName: body.workspaceName, reason: body.reason.trim(), ...(body.ticketRef?.trim() ? { ticketRef: body.ticketRef.trim() } : {}) } };
  }
  if (definition.method !== "POST" || definition.upstreamTemplate !== "/admin/v1/workspaces/:workspaceId/members") {
    return { ok: true, body };
  }

  const allowedFields = new Set(["userId", "role", "createUserIfMissing", "reason", "ticketRef"]);
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((field) => !allowedFields.has(field))) {
    return { ok: false, message: "Only existing-user workspace access fields are allowed" };
  }
  if (typeof body.userId !== "string" || !body.userId.trim()) {
    return { ok: false, message: "userId is required" };
  }
  if (typeof body.role !== "string" || !body.role.trim()) {
    return { ok: false, message: "role is required" };
  }
  if (typeof body.reason !== "string" || body.reason.trim().length < 3) {
    return { ok: false, message: "reason must contain at least 3 characters" };
  }
  if (body.createUserIfMissing !== undefined && body.createUserIfMissing !== false) {
    return { ok: false, message: "The platform admin console cannot create user accounts" };
  }
  if (body.ticketRef !== undefined && typeof body.ticketRef !== "string") {
    return { ok: false, message: "ticketRef must be a string" };
  }

  return {
    ok: true,
    body: {
      userId: body.userId.trim(),
      role: body.role.trim(),
      createUserIfMissing: false,
      reason: body.reason.trim(),
      ...(body.ticketRef?.trim() ? { ticketRef: body.ticketRef.trim() } : {})
    }
  };
}

export function matchAdminRoute(method, pathname) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  for (const definition of ADMIN_ROUTE_DEFINITIONS) {
    if (definition.method !== normalizedMethod) continue;
    const match = definition.browserRegex.exec(pathname);
    if (!match) continue;

    const values = Object.fromEntries(definition.params.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
    let upstreamPath = definition.upstreamTemplate;
    for (const [name, value] of Object.entries(values)) {
      upstreamPath = upstreamPath.replace(`:${name}`, encodeURIComponent(value));
    }
    return { ...definition, values, upstreamPath };
  }
  return null;
}

export function isGovernanceOnlyUpstreamPath(pathname) {
  if (!pathname.startsWith("/admin/v1/")) return false;
  const containsOperationalResource = /(?:logs?|targets?|agents?|runs?|commands?|tools?|credentials?|prompts?|workspace-audit-events?)/i.test(pathname);
  const containsSessionAccess = /\/sessions?(?:\/|$)/i.test(pathname);
  return !containsOperationalResource && !containsSessionAccess;
}
