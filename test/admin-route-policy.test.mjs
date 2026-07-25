import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ROUTE_DEFINITIONS, isGovernanceOnlyUpstreamPath, matchAdminRoute, sanitizedAdminBody, sanitizedAdminQuery } from "../lib/admin-route-policy.mjs";
import { ALLOWED_ADMIN_SCOPES, FORBIDDEN_ADMIN_SCOPES, projectAdminResponse, validateAdminIdentity } from "../lib/admin-contract.mjs";

test("all runtime routes use the admin namespace and governance-only nouns", () => {
  assert.equal(ADMIN_ROUTE_DEFINITIONS.length, 18);
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
    id: "ws_atlas", name: "Atlas", plan: { key: "team", name: "Team" }, createdBy: "usr_1", createdAt: "2026-01-01T00:00:00Z", clusterCount: 2, virtualMachineCount: 1, memberCount: 3, lifecycleStatus: "active",
    quota: { members: { used: 3, limit: 10 }, kubernetesClusters: { used: 2, limit: 5 }, virtualMachines: { used: 1, limit: 5 } },
    quotaOverrides: { members: null, kubernetesClusters: null, virtualMachines: null }, recentRunSummary: { running: 4 }, latestWorkspaceAuditAt: "secret"
  });
  assert.equal("recentRunSummary" in workspace, false);
  assert.equal("latestWorkspaceAuditAt" in workspace, false);
  assert.equal("quota" in workspace, false);
  assert.equal("quotaOverrides" in workspace, false);

  const auditRoute = matchAdminRoute("GET", "/admin-audit-events");
  const audit = projectAdminResponse(auditRoute, { items: [
    { id: "1", action: "admin.workspace.plan.update", outcome: "success", workspaceId: "ws", requestId: "req", sourceIpHash: "hidden", userAgent: "hidden", metadata: { ticketRef: "AO-1", correlationId: "corr-1", secretPayload: "hidden" }, occurredAt: "2026-01-01T00:00:00Z" },
    { id: "2", action: "admin.run.cancel", outcome: "success", targetId: "target", requestId: "req2", metadata: {}, occurredAt: "2026-01-01T00:00:00Z" }
  ] });
  assert.equal(audit.items.length, 1);
  assert.deepEqual(audit.items[0].metadata, { correlationId: "corr-1" });
  assert.equal("sourceIpHash" in audit.items[0], false);
  assert.equal("userAgent" in audit.items[0], false);
});

test("projects only typed platform setting state", () => {
  const route = matchAdminRoute("GET", "/settings");
  const projected = projectAdminResponse(route, {
    items: [{
      key: "password_signup",
      value: { enabled: false },
      deploymentDefault: { enabled: false },
      source: "deployment_default",
      version: 0,
      editable: true,
      constraints: { allowedValues: [false, true], enablementBlockers: ["Email unavailable"], smtpPassword: "hidden" },
      secret: "hidden"
    }]
  });
  assert.deepEqual(projected.items[0], {
    key: "password_signup",
    value: { enabled: false },
    deploymentDefault: { enabled: false },
    source: "deployment_default",
    version: 0,
    editable: true,
    constraints: { allowedValues: [false, true], enablementBlockers: ["Email unavailable"] }
  });
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
