import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ROUTE_DEFINITIONS, isGovernanceOnlyUpstreamPath, matchAdminRoute, sanitizedAdminBody, sanitizedAdminQuery } from "../lib/admin-route-policy.mjs";
import { ALLOWED_ADMIN_SCOPES, FORBIDDEN_ADMIN_SCOPES, projectAdminResponse, validateAdminIdentity } from "../lib/admin-contract.mjs";

test("all runtime routes use the admin namespace and governance-only nouns", () => {
  assert.equal(ADMIN_ROUTE_DEFINITIONS.length, 25);
  for (const route of ADMIN_ROUTE_DEFINITIONS) {
    assert.equal(isGovernanceOnlyUpstreamPath(route.upstreamTemplate), true, route.upstreamTemplate);
    assert.ok(ALLOWED_ADMIN_SCOPES.includes(route.requiredScope), route.requiredScope);
  }
});

test("allows only documented query parameters per route", () => {
  const workspaces = matchAdminRoute("GET", "/workspaces");
  assert.equal(sanitizedAdminQuery(workspaces, new URLSearchParams("q=atlas&planKey=team")).toString(), "q=atlas&planKey=team");
  assert.equal(sanitizedAdminQuery(workspaces, new URLSearchParams("targetId=target-1")), null);
  const detail = matchAdminRoute("GET", "/workspaces/ws_atlas");
  assert.equal(sanitizedAdminQuery(detail, new URLSearchParams("q=ignored")), null);
  const members = matchAdminRoute("GET", "/workspaces/ws_atlas/members");
  assert.equal(sanitizedAdminQuery(members, new URLSearchParams("limit=100&cursor=next")).toString(), "limit=100&cursor=next");
  assert.equal(sanitizedAdminQuery(members, new URLSearchParams("q=ignored")), null);
  const audit = matchAdminRoute("GET", "/admin-audit-events");
  assert.equal(sanitizedAdminQuery(audit, new URLSearchParams("workspaceQuery=Atlas+Research")).toString(), "workspaceQuery=Atlas+Research");
  assert.equal(sanitizedAdminQuery(audit, new URLSearchParams("workspaceName=Atlas")), null);
});

test("rejects broad and operational credentials", () => {
  assert.deepEqual(validateAdminIdentity({ adminApiEnabled: true, scopes: ALLOWED_ADMIN_SCOPES }), { ok: true });
  for (const forbidden of FORBIDDEN_ADMIN_SCOPES) {
    const result = validateAdminIdentity({ adminApiEnabled: true, scopes: [...ALLOWED_ADMIN_SCOPES, forbidden] });
    assert.equal(result.ok, false, forbidden);
  }
});

test("projects workspace and audit responses to the confidentiality boundary", () => {
  const workspaceRoute = matchAdminRoute("GET", "/workspaces/ws_atlas");
  const workspace = projectAdminResponse(workspaceRoute, {
    id: "ws_atlas", name: "Atlas", plan: { key: "team", name: "Team" }, createdBy: "usr_1", createdByDisplayName: "Maya Chen", createdByEmail: "maya@example.test", createdAt: "2026-01-01T00:00:00Z", clusterCount: 2, virtualMachineCount: 1, memberCount: 3, lifecycleStatus: "active",
    quota: { members: { used: 3, limit: 10 }, kubernetesClusters: { used: 2, limit: 5 }, virtualMachines: { used: 1, limit: 5 } },
    quotaOverrides: { members: null, kubernetesClusters: null, virtualMachines: null }, recentRunSummary: { running: 4 }, latestWorkspaceAuditAt: "secret"
  });
  assert.equal("recentRunSummary" in workspace, false);
  assert.equal("latestWorkspaceAuditAt" in workspace, false);
  assert.equal("quota" in workspace, false);
  assert.equal("quotaOverrides" in workspace, false);
  assert.equal(workspace.createdByDisplayName, "Maya Chen");
  assert.equal(workspace.createdByEmail, "maya@example.test");

  const auditRoute = matchAdminRoute("GET", "/admin-audit-events");
  const audit = projectAdminResponse(auditRoute, { items: [
    { id: "1", action: "admin.workspace.plan.update", outcome: "success", workspaceId: "ws", workspaceName: "Atlas", subjectType: "user", subjectId: "usr_1", subjectDisplayName: "Maya Chen", requestId: "req", sourceIpHash: "hidden", userAgent: "hidden", metadata: { ticketRef: "AO-1", correlationId: "corr-1", secretPayload: "hidden" }, occurredAt: "2026-01-01T00:00:00Z" },
    { id: "2", action: "admin.run.cancel", outcome: "success", targetId: "target", requestId: "req2", metadata: {}, occurredAt: "2026-01-01T00:00:00Z" },
    { id: "3", action: "admin.system.workspace_default.read", outcome: "success", requestId: "req3", metadata: {}, occurredAt: "2026-01-01T00:00:00Z" },
    { id: "4", action: "admin.admin_audit.search", outcome: "success", requestId: "req4", metadata: {}, occurredAt: "2026-01-01T00:00:00Z" }
  ] });
  assert.equal(audit.items.length, 1);
  assert.deepEqual(audit.items[0].metadata, { correlationId: "corr-1" });
  assert.equal("sourceIpHash" in audit.items[0], false);
  assert.equal("userAgent" in audit.items[0], false);
  assert.equal(audit.items[0].workspaceName, "Atlas");
  assert.equal(audit.items[0].subjectDisplayName, "Maya Chen");
});

test("projects only typed platform setting state", () => {
  const route = matchAdminRoute("GET", "/settings");
  const projected = projectAdminResponse(route, {
    items: [{
      key: "user_sign_in_methods",
      value: { methods: ["oidc", "unexpected", "oidc"] },
      deploymentDefault: { methods: ["password", "oidc"] },
      source: "deployment_default",
      version: 0,
      editable: true,
      constraints: { allowedMethods: ["oidc", "unexpected", "oidc"], methodBlockers: { password: ["Password disabled"], oidc: [], internal: ["hidden"] }, smtpPassword: "hidden" },
      secret: "hidden"
    }]
  });
  assert.deepEqual(projected.items[0], {
    key: "user_sign_in_methods",
    value: { methods: ["oidc"] },
    deploymentDefault: { methods: ["password", "oidc"] },
    source: "deployment_default",
    version: 0,
    editable: true,
    constraints: { allowedMethods: ["oidc"], methodBlockers: { password: ["Password disabled"], oidc: [] } }
  });
});

test("projects Kubernetes RBAC effective, deployment, and overlay values separately", () => {
  const route = matchAdminRoute("GET", "/settings");
  const profile = { key: "cnpg", name: "CNPG", resources: [{ apiGroup: "postgresql.cnpg.io", apiVersion: "v1", resource: "clusters", kind: "Cluster", scope: "namespaced", verbs: ["list", "patch"] }] };
  const projected = projectAdminResponse(route, { items: [{
    key: "kubernetes_rbac_additions",
    value: { additions: [profile] },
    deploymentDefault: { additions: [] },
    overrideValue: { upserts: [profile], disabledKeys: ["legacy"] },
    source: "runtime_override",
    version: 3,
    editable: true,
    constraints: { maxAdditions: 25, maxResourcesPerAddition: 50, allowedVerbs: ["get", "list", "watch", "create", "patch", "delete"], wildcardsAllowed: false, runtimeEditable: true }
  }] }).items[0];
  assert.deepEqual(projected.value, { additions: [profile] });
  assert.deepEqual(projected.deploymentDefault, { additions: [] });
  assert.deepEqual(projected.overrideValue, { upserts: [profile], disabledKeys: ["legacy"] });
  assert.deepEqual(projected.constraints, { maxAdditions: 25, maxResourcesPerAddition: 50, allowedVerbs: ["get", "list", "watch", "create", "patch", "delete"], wildcardsAllowed: false, runtimeEditable: true });
});

test("requires narrow exact-name lifecycle bodies", () => {
  for (const action of ["suspend", "restore"]) {
    const route = matchAdminRoute("POST", `/workspaces/ws_atlas/${action}`);
    assert.deepEqual(sanitizedAdminBody(route, { workspaceName: "Atlas", reason: "Support hold", ticketRef: "AO-3" }), {
      ok: true,
      body: { workspaceName: "Atlas", reason: "Support hold", ticketRef: "AO-3" }
    });
    assert.equal(sanitizedAdminBody(route, { reason: "Support hold" }).ok, false);
    assert.equal(sanitizedAdminBody(route, { workspaceName: " Atlas ", reason: "Support hold", destructive: true }).ok, false);
  }
});

test("matches declared routes and safely encodes identifiers", () => {
  const matched = matchAdminRoute("PATCH", "/workspaces/team%20one/members/user%2Fone/role");
  assert.equal(matched.upstreamPath, "/admin/v1/workspaces/team%20one/members/user%2Fone/role");
});

test("narrows workspace access grants to existing users", () => {
  const route = matchAdminRoute("POST", "/workspaces/ws_atlas/members");
  assert.equal(route.upstreamPath, "/admin/v1/workspaces/ws_atlas/members");
  assert.deepEqual(sanitizedAdminBody(route, { userId: "usr_ivy", role: "member", reason: "Approved access" }), {
    ok: true,
    body: { userId: "usr_ivy", role: "member", createUserIfMissing: false, reason: "Approved access" }
  });
  assert.equal(sanitizedAdminBody(route, { email: "new@example.com", role: "member", createUserIfMissing: true, reason: "Create user" }).ok, false);
});

test("allows only fixed versioned platform setting mutations", () => {
  const patch = matchAdminRoute("PATCH", "/settings/member_discovery");
  assert.equal(patch.upstreamPath, "/admin/v1/system/settings/member_discovery");
  assert.deepEqual(sanitizedAdminBody(patch, {
    value: { mode: "exact_email" },
    expectedVersion: 2,
    reason: "Privacy policy update"
  }), {
    ok: true,
    body: {
      value: { mode: "exact_email" },
      expectedVersion: 2,
      reason: "Privacy policy update"
    }
  });
  assert.equal(matchAdminRoute("PATCH", "/settings/arbitrary"), null);
  assert.equal(sanitizedAdminBody(patch, { value: {}, expectedVersion: -1, reason: "Invalid" }).ok, false);
  assert.equal(sanitizedAdminBody(patch, { value: {}, expectedVersion: 0, reason: "Valid", secret: "no" }).ok, false);
  const signInMethods = matchAdminRoute("PATCH", "/settings/user_sign_in_methods");
  assert.deepEqual(sanitizedAdminBody(signInMethods, {
    value: { methods: ["password", "oidc"] },
    expectedVersion: 2,
    reason: "Allow both workspace sign-in methods"
  }), {
    ok: true,
    body: { value: { methods: ["password", "oidc"] }, expectedVersion: 2, reason: "Allow both workspace sign-in methods" }
  });
  assert.equal(sanitizedAdminBody(signInMethods, { value: { methods: [] }, expectedVersion: 2, reason: "No sign-in methods" }).ok, false);
  assert.equal(sanitizedAdminBody(signInMethods, { value: { methods: ["password", "password"] }, expectedVersion: 2, reason: "Duplicate sign-in methods" }).ok, false);
  const additions = matchAdminRoute("PATCH", "/settings/kubernetes_rbac_additions");
  const profile = { key: "cnpg", name: "CNPG", resources: [{ apiGroup: "postgresql.cnpg.io", apiVersion: "v1", resource: "clusters", kind: "Cluster", scope: "namespaced", verbs: ["get", "list", "watch", "create", "patch", "delete"] }] };
  const value = { upserts: [profile], disabledKeys: [] };
  assert.equal(sanitizedAdminBody(additions, { value, expectedVersion: 1, reason: "Add CNPG onboarding access" }).ok, true);
  assert.equal(sanitizedAdminBody(additions, { value: { upserts: [{ ...profile, resources: [{ ...profile.resources[0], verbs: ["patch"] }] }], disabledKeys: [] }, expectedVersion: 1, reason: "Unsafe patch-only access" }).ok, false);
  assert.equal(sanitizedAdminBody(additions, { value: { upserts: [{ ...profile, resources: [{ ...profile.resources[0], verbs: ["list", "update"] }] }], disabledKeys: [] }, expectedVersion: 1, reason: "Unsupported update access" }).ok, false);
  assert.equal(sanitizedAdminBody(additions, { value: { upserts: [{ ...profile, resources: [{ ...profile.resources[0], resource: "*" }] }], disabledKeys: [] }, expectedVersion: 1, reason: "Unsafe wildcard access" }).ok, false);
  assert.equal(sanitizedAdminBody(additions, { value: { upserts: [profile], disabledKeys: ["cnpg"] }, expectedVersion: 1, reason: "Conflicting profile state" }).ok, false);
});

test("allows only write-only fixed provider default mutations", () => {
  const list = matchAdminRoute("GET", "/llm-provider-defaults");
  const put = matchAdminRoute("PUT", "/llm-provider-defaults/openai");
  const remove = matchAdminRoute("DELETE", "/llm-provider-defaults/openai");
  assert.equal(list.upstreamPath, "/admin/v1/system/llm-provider-defaults");
  assert.equal(put.upstreamPath, "/admin/v1/system/llm-provider-defaults/openai");
  assert.deepEqual(sanitizedAdminBody(put, {
    apiKey: "  write-only-key  ",
    reason: "Rotate platform default"
  }), {
    ok: true,
    body: { apiKey: "write-only-key", reason: "Rotate platform default" }
  });
  assert.deepEqual(sanitizedAdminBody(remove, {
    reason: "Delete platform default"
  }), {
    ok: true,
    body: { reason: "Delete platform default" }
  });
  assert.equal(matchAdminRoute("PUT", "/llm-provider-defaults/unknown"), null);
  assert.equal(sanitizedAdminBody(put, { apiKey: "", reason: "Invalid" }).ok, false);
  assert.equal(sanitizedAdminBody(put, { apiKey: "secret", reason: "Valid", expose: true }).ok, false);

  const projected = projectAdminResponse(list, {
    providers: [{
      provider: "openai",
      configured: true,
      enabled: true,
      source: "platform_default",
      apiKey: "must-not-leak",
      secretName: "openai_api_key"
    }]
  });
  assert.deepEqual(projected, {
    providers: [{
      provider: "openai",
      configured: true,
      enabled: true,
      source: "platform_default"
    }]
  });
  assert.doesNotMatch(JSON.stringify(projected), /must-not-leak|secretName|apiKey/);
});

test("allows only secret-free public workspace defaults", () => {
  const create = matchAdminRoute("POST", "/workspace-defaults");
  const valid = sanitizedAdminBody(create, {
    kind: "mcp_server",
    name: "GitHub",
    availableIn: ["virtual_machines", "agents"],
    source: { type: "https", endpoint: "https://mcp.example.test/service" },
    reason: "Seed future workspaces"
  });
  assert.deepEqual(valid, {
    ok: true,
    body: {
      kind: "mcp_server",
      name: "GitHub",
      availableIn: ["agents", "virtual_machines"],
      source: { type: "https", endpoint: "https://mcp.example.test/service" },
      reason: "Seed future workspaces"
    }
  });
  const manualSkill = sanitizedAdminBody(create, {
    kind: "skill",
    availableIn: ["kubernetes", "agents"],
    source: { type: "manual" },
    files: [{ path: "SKILL.md", content: "---\nname: triage\ndescription: Triage incidents\n---\n" }],
    reason: "Create manual platform skill"
  });
  assert.deepEqual(manualSkill, {
    ok: true,
    body: {
      kind: "skill",
      availableIn: ["agents", "kubernetes"],
      source: { type: "manual" },
      files: [{ path: "SKILL.md", content: "---\nname: triage\ndescription: Triage incidents\n---\n" }],
      reason: "Create manual platform skill"
    }
  });
  assert.equal(sanitizedAdminBody(create, {
    ...manualSkill.body,
    source: { type: "manual", secret: "must-not-pass" }
  }).ok, false);
  const patch = matchAdminRoute("PATCH", "/workspace-defaults/default-1");
  assert.deepEqual(sanitizedAdminBody(patch, {
    enabled: false,
    reason: "Pause future workspace initialization"
  }), {
    ok: true,
    body: {
      enabled: false,
      reason: "Pause future workspace initialization"
    }
  });
  assert.equal(sanitizedAdminBody(patch, {
    reason: "Reject empty update"
  }).ok, false);
  assert.equal(sanitizedAdminBody(patch, {
    enabled: "false",
    reason: "Reject invalid status"
  }).ok, false);
  for (const endpoint of [
    "https://localhost/mcp",
    "https://127.0.0.1/mcp",
    "https://8.8.8.8/mcp",
    "https://mcp.example.test/path?token=secret"
  ]) {
    assert.equal(sanitizedAdminBody(create, {
      kind: "mcp_server",
      name: "Rejected",
      availableIn: ["agents"],
      source: { type: "https", endpoint },
      reason: "Reject unsafe endpoint"
    }).ok, false, endpoint);
  }

  const list = matchAdminRoute("GET", "/workspace-defaults");
  const projected = projectAdminResponse(list, {
    items: [{
      id: "default-1",
      kind: "skill",
      name: "Triage",
      description: "Triage incidents",
      availableIn: ["agents"],
      source: {
        type: "git",
        provider: "github",
        repoUrl: "https://github.com/acornops/skills",
        apiBaseUrl: "https://github.internal/api/v3",
        ref: "main",
        commitSha: "0123456789abcdef0123456789abcdef01234567"
      },
      files: [{ path: "SKILL.md", content: "must-not-leak" }],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z"
    }]
  });
  assert.equal("apiBaseUrl" in projected.items[0].source, false);
  assert.equal("files" in projected.items[0], false);
  assert.equal(projected.items[0].enabled, true);
  assert.doesNotMatch(JSON.stringify(projected), /must-not-leak|github\.internal/);
  const projectedManual = projectAdminResponse(list, {
    items: [{
      id: "default-2",
      kind: "skill",
      name: "Manual triage",
      description: "Triage incidents",
      availableIn: ["agents"],
      source: { type: "manual", secret: "must-not-leak" },
      files: [{ path: "SKILL.md", content: "must-not-leak" }],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z"
    }]
  });
  assert.deepEqual(projectedManual.items[0].source, { type: "manual" });
  assert.equal("files" in projectedManual.items[0], false);
  assert.doesNotMatch(JSON.stringify(projectedManual), /must-not-leak/);
});

test("denies operational, tenant-audit, arbitrary, and wrong-method routes", () => {
  const forbidden = [
    ["GET", "/workspaces/ws/logs"],
    ["GET", "/workspaces/ws/targets"],
    ["GET", "/runs/run_1"],
    ["POST", "/workspaces"],
    ["GET", "/workspaces/ws/audit-events"],
    ["POST", "/users/usr_1/sessions/revoke"],
    ["GET", "/../api/v1/workspaces"]
  ];
  for (const [method, path] of forbidden) assert.equal(matchAdminRoute(method, path), null, `${method} ${path}`);
});
