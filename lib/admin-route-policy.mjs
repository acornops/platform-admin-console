import { isIP } from "node:net";

const segment = "([^/]+)";

export const ADMIN_ROUTE_DEFINITIONS = Object.freeze([
  route("GET", "/me", "/admin/v1/me", "admin:self", "identity"),
  route("GET", "/system/readiness", "/admin/v1/system/readiness", "admin:system:read", "read"),
  route("GET", "/system/config", "/admin/v1/system/config", "admin:system:read", "read"),
  route("GET", "/settings", "/admin/v1/system/settings", "admin:system:read", "read"),
  route("PATCH", "/settings/(member_discovery|ai_policy|user_sign_in_methods|kubernetes_rbac_additions)", "/admin/v1/system/settings/:settingKey", "admin:system:write", "write", ["settingKey"]),
  route("DELETE", "/settings/(member_discovery|ai_policy|user_sign_in_methods|kubernetes_rbac_additions)", "/admin/v1/system/settings/:settingKey", "admin:system:write", "write", ["settingKey"]),
  route("GET", "/llm-provider-defaults", "/admin/v1/system/llm-provider-defaults", "admin:system:read", "read"),
  route("PUT", "/llm-provider-defaults/(openai|anthropic|gemini)", "/admin/v1/system/llm-provider-defaults/:provider", "admin:system:write", "write", ["provider"]),
  route("DELETE", "/llm-provider-defaults/(openai|anthropic|gemini)", "/admin/v1/system/llm-provider-defaults/:provider", "admin:system:write", "write", ["provider"]),
  route("GET", "/workspace-defaults", "/admin/v1/system/workspace-defaults", "admin:system:read", "read", [], ["kind", "availableIn", "q"]),
  route("POST", "/workspace-defaults", "/admin/v1/system/workspace-defaults", "admin:system:write", "write"),
  route("PATCH", `/workspace-defaults/${segment}`, "/admin/v1/system/workspace-defaults/:id", "admin:system:write", "write", ["id"]),
  route("DELETE", `/workspace-defaults/${segment}`, "/admin/v1/system/workspace-defaults/:id", "admin:system:write", "write", ["id"]),
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
  route("GET", "/admin-audit-events", "/admin/v1/admin-audit-events", "admin:audit:read", "audit", [], ["adminActorSubject", "action", "actionGroup", "outcome", "workspaceId", "workspaceQuery", "from", "to", "limit", "cursor"])
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
  if (definition.upstreamTemplate === "/admin/v1/system/workspace-defaults") {
    if (definition.method !== "POST") return { ok: true, body };
    return sanitizeWorkspaceDefaultCreate(body);
  }
  if (definition.upstreamTemplate === "/admin/v1/system/workspace-defaults/:id") {
    const allowedFields = new Set(definition.method === "PATCH" ? ["availableIn", "enabled", "reason"] : ["reason"]);
    if (!plainObject(body) || Object.keys(body).some((field) => !allowedFields.has(field))) {
      return { ok: false, message: "Only workspace-default governance fields are allowed" };
    }
    if (!validReason(body.reason)) return { ok: false, message: "reason must contain at least 3 characters" };
    const patchingAvailability = definition.method === "PATCH" && body.availableIn !== undefined;
    const patchingEnabled = definition.method === "PATCH" && body.enabled !== undefined;
    if (definition.method === "PATCH" && !patchingAvailability && !patchingEnabled) {
      return { ok: false, message: "availableIn or enabled is required" };
    }
    if (patchingAvailability && !validAvailability(body.availableIn)) {
      return { ok: false, message: "availableIn is invalid" };
    }
    if (patchingEnabled && typeof body.enabled !== "boolean") {
      return { ok: false, message: "enabled must be a boolean" };
    }
    return { ok: true, body: {
      ...(patchingAvailability ? { availableIn: canonicalAvailability(body.availableIn) } : {}),
      ...(patchingEnabled ? { enabled: body.enabled } : {}),
      reason: body.reason.trim()
    } };
  }
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
    if (!resetting && definition.values?.settingKey === "user_sign_in_methods") {
      const methods = body.value.methods;
      if (!Array.isArray(methods) || methods.length === 0 || methods.some((method) => !["password", "oidc"].includes(method)) || new Set(methods).size !== methods.length || Object.keys(body.value).length !== 1) {
        return { ok: false, message: "user_sign_in_methods must contain one or more unique password or oidc methods" };
      }
    }
    if (!resetting && definition.values?.settingKey === "kubernetes_rbac_additions" && !validKubernetesRbacAdditionsOverride(body.value)) {
      return { ok: false, message: "kubernetes_rbac_additions must contain valid profile upserts and disabled keys" };
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

function validKubernetesRbacAdditionsOverride(value) {
  if (!plainObject(value) || Object.keys(value).some((key) => !["upserts", "disabledKeys"].includes(key)) || !Array.isArray(value.upserts) || !Array.isArray(value.disabledKeys) || value.upserts.length > 25 || value.disabledKeys.length > 25) return false;
  if (value.disabledKeys.some((key) => typeof key !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key)) || new Set(value.disabledKeys).size !== value.disabledKeys.length) return false;
  const keys = new Set();
  for (const addition of value.upserts) {
    if (!plainObject(addition) || Object.keys(addition).some((key) => !["key", "name", "description", "resources"].includes(key))) return false;
    if (typeof addition.key !== "string" || addition.key.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(addition.key) || keys.has(addition.key) || typeof addition.name !== "string" || !addition.name.trim() || addition.name.trim().length > 80 || !Array.isArray(addition.resources) || addition.resources.length < 1 || addition.resources.length > 50) return false;
    if (addition.description !== undefined && (typeof addition.description !== "string" || addition.description.length > 240)) return false;
    keys.add(addition.key);
    if (value.disabledKeys.includes(addition.key)) return false;
    const resources = new Set();
    for (const resource of addition.resources) {
      if (!plainObject(resource) || Object.keys(resource).some((key) => !["apiGroup", "apiVersion", "resource", "kind", "scope", "verbs"].includes(key))) return false;
      const identity = `${resource.apiGroup}/${resource.apiVersion}/${resource.resource}`;
      if (typeof resource.apiGroup !== "string" || resource.apiGroup.length > 253 || !/^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/.test(resource.apiGroup) || typeof resource.apiVersion !== "string" || resource.apiVersion.length > 63 || !/^[a-z0-9][a-z0-9.-]*$/.test(resource.apiVersion) || typeof resource.resource !== "string" || resource.resource.length > 253 || !/^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/.test(resource.resource) || typeof resource.kind !== "string" || resource.kind.length > 128 || !/^[A-Z][A-Za-z0-9]*$/.test(resource.kind) || !["namespaced", "cluster"].includes(resource.scope) || !Array.isArray(resource.verbs) || resource.verbs.length < 1 || resource.verbs.length > 6 || resource.verbs.some((verb) => !["get", "list", "watch", "create", "patch", "delete"].includes(verb)) || new Set(resource.verbs).size !== resource.verbs.length || (resource.verbs.includes("patch") && !resource.verbs.includes("list")) || resources.has(identity)) return false;
      resources.add(identity);
    }
  }
  return true;
}

function sanitizeWorkspaceDefaultCreate(body) {
  if (!plainObject(body) || !["mcp_server", "skill"].includes(body.kind) || !validAvailability(body.availableIn) || !validReason(body.reason)) {
    return { ok: false, message: "Workspace default payload is invalid" };
  }
  if (body.kind === "mcp_server") {
    const allowed = new Set(["kind", "name", "availableIn", "source", "reason"]);
    if (Object.keys(body).some((field) => !allowed.has(field))
      || typeof body.name !== "string" || !body.name.trim()
      || !plainObject(body.source) || body.source.type !== "https"
      || Object.keys(body.source).some((field) => !["type", "endpoint"].includes(field))
      || typeof body.source.endpoint !== "string"
      || !validPublicHttpsUrl(body.source.endpoint)) {
      return { ok: false, message: "MCP default payload is invalid" };
    }
    return { ok: true, body: {
      kind: "mcp_server",
      name: body.name.trim(),
      availableIn: canonicalAvailability(body.availableIn),
      source: { type: "https", endpoint: body.source.endpoint.trim() },
      reason: body.reason.trim()
    } };
  }
  const allowed = new Set(["kind", "availableIn", "source", "files", "reason"]);
  const gitSourceAllowed = new Set(["type", "provider", "repoUrl", "ref", "subpath", "commitSha"]);
  const manualSource = plainObject(body.source)
    && body.source.type === "manual"
    && Object.keys(body.source).every((field) => field === "type");
  const gitSource = plainObject(body.source)
    && body.source.type === "git"
    && ["github", "gitlab"].includes(body.source.provider)
    && Object.keys(body.source).every((field) => gitSourceAllowed.has(field))
    && typeof body.source.repoUrl === "string"
    && typeof body.source.ref === "string"
    && validPublicGitSource(body.source)
    && /^[0-9a-f]{40}$/i.test(body.source.commitSha || "");
  if (Object.keys(body).some((field) => !allowed.has(field))
    || (!manualSource && !gitSource)
    || !Array.isArray(body.files) || body.files.length < 1 || body.files.length > 16
    || body.files.some((file) => !plainObject(file) || Object.keys(file).some((field) => !["path", "content"].includes(field))
      || typeof file.path !== "string" || typeof file.content !== "string" || new TextEncoder().encode(file.content).byteLength > 32768)
    || body.files.reduce((size, file) => size + new TextEncoder().encode(file.content || "").byteLength, 0) > 131072) {
    return { ok: false, message: "Skill default payload is invalid" };
  }
  return { ok: true, body: {
    kind: "skill",
    availableIn: canonicalAvailability(body.availableIn),
    source: structuredClone(body.source),
    files: body.files.map((file) => ({ path: file.path, content: file.content })),
    reason: body.reason.trim()
  } };
}

function plainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validAvailability(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 3
    && value.every((destination) => ["agents", "kubernetes", "virtual_machines"].includes(destination))
    && new Set(value).size === value.length;
}
function canonicalAvailability(value) {
  return ["agents", "kubernetes", "virtual_machines"].filter((destination) => value.includes(destination));
}
function validPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    return value.length <= 2048
      && url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && !isIP(hostname)
      && !/^localhost$/i.test(hostname)
      && !/\.localhost$/i.test(hostname)
      && !/\.local$/i.test(hostname);
  } catch {
    return false;
  }
}
function validPublicGitSource(source) {
  try {
    const url = new URL(source.repoUrl);
    const expectedHost = source.provider === "github" ? "github.com" : "gitlab.com";
    return url.protocol === "https:" && url.hostname === expectedHost && !url.username && !url.password;
  } catch {
    return false;
  }
}
function validReason(value) { return typeof value === "string" && value.trim().length >= 3 && value.length <= 500; }

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
