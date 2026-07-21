import assert from "node:assert/strict";
import test from "node:test";
import { createAdminConsoleServer } from "../server.mjs";

async function withServer(options, run) {
  const server = createAdminConsoleServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("production startup fails closed outside control-plane mode", () => {
  assert.throws(
    () => createAdminConsoleServer({ nodeEnv: "production", mode: "mock" }),
    /requires ADMIN_CONSOLE_DATA_MODE=control-plane/
  );
});

test("reports local liveness and upstream-aware readiness without requiring a human session", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return Response.json({ status: "ok" });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const live = await fetch(`${base}/health/live`);
    assert.equal(live.status, 200);
    assert.equal((await live.json()).service, "platform-admin-console");
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: "ok", mode: "control-plane", upstream: "ok" });
    assert.deepEqual(calls, ["https://control.example/ready"]);
    const denied = await fetch(`${base}/health/live`, { method: "POST" });
    assert.equal(denied.status, 405);
    assert.equal((await denied.json()).error.code, "METHOD_NOT_ALLOWED");
  });
});

test("fails readiness closed when the control plane is unavailable", async () => {
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl: async () => { throw new Error("offline"); } }, async (base) => {
    const response = await fetch(`${base}/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "degraded", mode: "control-plane", upstream: "down" });
  });
});

test("forwards every control-plane CSRF cookie as a distinct response header", async () => {
  const fetchImpl = async () => {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", "acornops_cp_csrf=cp-token; Path=/; SameSite=Strict");
    headers.append("set-cookie", "acornops_admin_csrf=admin-token; Path=/; SameSite=Strict");
    return new Response(JSON.stringify({ csrfToken: "admin-token" }), { status: 200, headers });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/auth/csrf`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.headers.getSetCookie(), [
      "acornops_cp_csrf=cp-token; Path=/; SameSite=Strict",
      "acornops_admin_csrf=admin-token; Path=/; SameSite=Strict"
    ]);
  });
});

test("proxies the allowlisted admin login redirect without a workload credential", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(null, {
      status: 302,
      headers: { location: "https://identity.example/authorize?state=opaque" }
    });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "workload-secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-auth/oidc/login?return_to=%2Fworkspaces&reauthenticate=true`, {
      redirect: "manual",
      headers: { cookie: "existing=session", "user-agent": "admin-console-test", "x-request-id": "request-123" }
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://identity.example/authorize?state=opaque");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://control.example/admin-auth/oidc/login?return_to=%2Fworkspaces&reauthenticate=true");
    assert.equal(calls[0].options.redirect, "manual");
    assert.equal(calls[0].options.headers.authorization, undefined);
    assert.equal(calls[0].options.headers.cookie, "existing=session");
    assert.equal(calls[0].options.headers["user-agent"], "admin-console-test");
    assert.equal(calls[0].options.headers["x-request-id"], "request-123");
  });
});

test("preserves callback redirects and every admin session cookie", async () => {
  const fetchImpl = async () => {
    const headers = new Headers({
      location: "http://127.0.0.1:14173/workspaces",
      "content-type": "text/plain; charset=utf-8"
    });
    headers.append("set-cookie", "__Host-acornops_admin_session=opaque; Path=/; HttpOnly; Secure; SameSite=Strict");
    headers.append("set-cookie", "acornops_admin_csrf=csrf; Path=/; SameSite=Strict");
    return new Response("Found", { status: 302, headers });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-auth/oidc/callback?code=code-1&state=state-1`, { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "http://127.0.0.1:14173/workspaces");
    assert.equal(await response.text(), "Found");
    assert.deepEqual(response.headers.getSetCookie(), [
      "__Host-acornops_admin_session=opaque; Path=/; HttpOnly; Secure; SameSite=Strict",
      "acornops_admin_csrf=csrf; Path=/; SameSite=Strict"
    ]);
  });
});

test("forwards logout session and CSRF evidence through the auth proxy", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ status: "ok" }, {
      headers: { "set-cookie": "__Host-acornops_admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict" }
    });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-auth/logout`, {
      method: "POST",
      headers: {
        cookie: "__Host-acornops_admin_session=opaque; acornops_admin_csrf=csrf",
        origin: base,
        "x-csrf-token": "csrf"
      }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(calls[0].url, "https://control.example/admin-auth/logout");
    assert.equal(calls[0].options.headers.cookie, "__Host-acornops_admin_session=opaque; acornops_admin_csrf=csrf");
    assert.equal(calls[0].options.headers.origin, base);
    assert.equal(calls[0].options.headers["x-csrf-token"], "csrf");
  });
});

test("admin auth routing fails closed instead of serving the SPA", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("unexpected"); };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const unknown = await fetch(`${base}/admin-auth/oidc/unknown`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get("content-type"), /application\/json/);
    assert.equal((await unknown.json()).error.code, "ADMIN_AUTH_ROUTE_NOT_ALLOWED");

    const wrongMethod = await fetch(`${base}/admin-auth/oidc/login`, { method: "POST" });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "GET");

    const unexpectedQuery = await fetch(`${base}/admin-auth/oidc/login?redirect_uri=https%3A%2F%2Fevil.example`);
    assert.equal(unexpectedQuery.status, 400);
    assert.equal((await unexpectedQuery.json()).error.code, "VALIDATION_ERROR");
    assert.equal(called, false);
  });
});

test("serves the application with security headers", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const response = await fetch(`${base}/workspaces/ws_atlas`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
    assert.match(await response.text(), /Platform Admin/);
  });
});

test("self-hosts the management-console typography", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const response = await fetch(`${base}/fonts/outfit-latin-600-normal.woff2`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "font/woff2");
    assert.match(response.headers.get("cache-control"), /immutable/);
    assert.ok((await response.arrayBuffer()).byteLength > 1_000);
  });
});

test("permits allowlisted governance routes and denies tenant routes", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const allowed = await fetch(`${base}/admin-console-api/workspaces`);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    const denied = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/logs`);
    assert.equal(denied.status, 404);
    assert.equal((await denied.json()).error.code, "ADMIN_ROUTE_NOT_ALLOWED");
    const deniedQuery = await fetch(`${base}/admin-console-api/workspaces?targetId=target-1`);
    assert.equal(deniedQuery.status, 400);
    assert.equal((await deniedQuery.json()).error.code, "VALIDATION_ERROR");
  });
});

test("mock admin audit supports the cursor pagination used by the events page", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const first = await fetch(`${base}/admin-console-api/admin-audit-events?limit=2`).then((response) => response.json());
    assert.equal(first.items.length, 2);
    assert.equal(first.nextCursor, "mock:2");
    const second = await fetch(`${base}/admin-console-api/admin-audit-events?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`).then((response) => response.json());
    assert.equal(second.items.length, 1);
    assert.equal(second.nextCursor, undefined);
    assert.equal(new Set([...first.items, ...second.items].map((event) => event.id)).size, 3);
  });
});

test("mock admin audit applies every supported filter before pagination", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const get = (query) => fetch(`${base}/admin-console-api/admin-audit-events?${query}`).then((response) => response.json());
    const byEvent = await get("action=admin.workspace.plan.update");
    assert.deepEqual(byEvent.items.map((event) => event.action), ["admin.workspace.plan.update"]);
    const byWorkspace = await get("workspaceId=ws_atlas");
    assert.ok(byWorkspace.items.length > 0);
    assert.ok(byWorkspace.items.every((event) => event.workspaceId === "ws_atlas"));
    const byActor = await get("adminActorSubject=mock-platform-admin");
    assert.equal(byActor.items.length, 3);
    assert.equal((await get("adminActorSubject=unknown")).items.length, 0);
    assert.equal((await get("outcome=failure")).items.length, 0);
    const byStart = await get(`from=${encodeURIComponent("2026-07-15T00:00:00Z")}`);
    assert.deepEqual(byStart.items.map((event) => event.workspaceId), ["ws_lumen"]);
    const byEnd = await get(`to=${encodeURIComponent("2026-07-14T14:02:59Z")}`);
    assert.deepEqual(byEnd.items.map((event) => event.workspaceId), ["ws_atlas"]);
    const combined = await get("workspaceId=ws_atlas&action=admin.member.role.update&outcome=success&limit=1");
    assert.equal(combined.items.length, 1);
    assert.equal(combined.items[0].metadata.correlationId, "7c2f8391-6f96-4d47-a8b2-5902f3f091ad");
    assert.equal(combined.nextCursor, undefined);
  });
});

test("mock admin audit groups workspace access and status actions", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: "usr_noor", role: "member", createUserIfMissing: false, reason: "Test grouped access filter" }) });
    await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members/usr_noor`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Test grouped access filter" }) });
    await fetch(`${base}/admin-console-api/workspaces/ws_lumen/suspend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceName: "Lumen Cooperative", reason: "Test grouped status filter" }) });
    const access = await fetch(`${base}/admin-console-api/admin-audit-events?actionGroup=workspace_access_modified`).then((response) => response.json());
    const status = await fetch(`${base}/admin-console-api/admin-audit-events?actionGroup=workspace_status_modified`).then((response) => response.json());
    assert.deepEqual(new Set(access.items.map((event) => event.action)), new Set(["admin.workspace.member.add", "admin.workspace.member.delete", "admin.member.role.update"]));
    assert.deepEqual(status.items.map((event) => event.action), ["admin.workspace.suspend"]);
  });
});

test("mock users support cursor pagination, identity search, and verification filters", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const first = await fetch(`${base}/admin-console-api/users?limit=2`).then((response) => response.json());
    assert.equal(first.items.length, 2);
    assert.equal(typeof first.nextCursor, "string");
    assert.equal(first.items.find((user) => user.id === "usr_maya").workspaceMembershipCount, 1);

    const second = await fetch(`${base}/admin-console-api/users?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`).then((response) => response.json());
    assert.equal(second.items.length, 2);
    assert.equal(new Set([...first.items, ...second.items].map((user) => user.id)).size, 4);

    const byId = await fetch(`${base}/admin-console-api/users?q=usr_sam`).then((response) => response.json());
    assert.deepEqual(byId.items.map((user) => user.id), ["usr_sam"]);

    const unverified = await fetch(`${base}/admin-console-api/users?emailVerified=false`).then((response) => response.json());
    assert.ok(unverified.items.length > 0);
    assert.ok(unverified.items.every((user) => user.emailVerified === false));

    const detail = await fetch(`${base}/admin-console-api/users/usr_sam`).then((response) => response.json());
    assert.equal("activeSessionCount" in detail, false);
    const samSummary = await fetch(`${base}/admin-console-api/users?q=usr_sam`).then((response) => response.json());
    assert.equal(samSummary.items[0].workspaceMembershipCount, detail.memberships.length);
  });
});

test("mock workspaces retain contract-backed filters and expose governance lifecycle fields", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const filtered = await fetch(`${base}/admin-console-api/workspaces?q=north&planKey=starter&limit=2`).then((response) => response.json());
    assert.deepEqual(filtered.items.map((workspace) => workspace.id), ["ws_northstar"]);
    const over = await fetch(`${base}/admin-console-api/workspaces?overLimit=true&limit=2`).then((response) => response.json());
    assert.deepEqual(over.items, []);
    const within = await fetch(`${base}/admin-console-api/workspaces?overLimit=false&limit=2`).then((response) => response.json());
    assert.equal(within.items.length, 2);
    assert.equal(typeof within.nextCursor, "string");
    assert.ok(within.items.every((workspace) => workspace.lifecycleStatus === "active"));
    assert.ok(within.items.every((workspace) => Number.isInteger(workspace.clusterCount) && Number.isInteger(workspace.virtualMachineCount)));
    assert.ok(within.items.every((workspace) => !("quota" in workspace) && !("quotaOverrides" in workspace)));
  });
});

test("mock workspace members use the authoritative paginated route", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const first = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members?limit=2`).then((response) => response.json());
    assert.equal(first.items.length, 2);
    assert.equal(typeof first.nextCursor, "string");
    assert.ok(first.items.every((member) => member.workspaceId === "ws_atlas"));
    assert.ok(first.items.every((member) => !Object.hasOwn(member, "source")));
    const second = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`).then((response) => response.json());
    assert.equal(new Set([...first.items, ...second.items].map((member) => member.userId)).size, 3);
  });
});

test("never forwards an undeclared path in control-plane mode", async () => {
  let called = false;
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl: async () => { called = true; throw new Error("unexpected"); } }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/api/v1/workspaces`);
    assert.equal(response.status, 404);
    assert.equal(called, false);
  });
});

test("control-plane mode verifies least-privilege identity before forwarding", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), authorization: options.headers.authorization });
    if (String(url).endsWith("/admin/v1/me")) return Response.json({ tokenId: "admin-1", scopes: ["admin:self", "admin:workspace:read"], adminApiEnabled: true });
    return Response.json({ items: [] });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/workspaces`);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://control.example/admin/v1/me");
    assert.equal(calls[1].url, "https://control.example/admin/v1/workspaces");
    assert.equal(calls[1].authorization, "Bearer secret");
  });
});

test("control-plane mode rejects admin wildcard before forwarding the requested route", async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(String(url)); return Response.json({ tokenId: "broad", scopes: ["admin:*"], adminApiEnabled: true }); };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/workspaces`);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "ADMIN_CREDENTIAL_REJECTED");
    assert.deepEqual(calls, ["https://control.example/admin/v1/me"]);
  });
});

test("production gateway requires a fixed human role and forwards session and CSRF evidence", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers });
    if (String(url).endsWith("/admin/v1/me")) {
      return Response.json({
        tokenId: "admin-console-bff",
        scopes: ["admin:self", "admin:member:write"],
        adminApiEnabled: true,
        actor: { issuer: "https://idp.example.test/realms/acornops", subject: "user-123", roles: ["platform-admin"] }
      });
    }
    return new Response(null, { status: 204 });
  };
  await withServer({ nodeEnv: "production", mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members/usr_sam`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: "__Host-acornops_admin_session=opaque-session",
        origin: "https://admin.acornops.dev",
        "x-csrf-token": "signed-csrf-token"
      },
      body: JSON.stringify({ reason: "Approved access removal" })
    });
    assert.equal(response.status, 204);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.headers.cookie, "__Host-acornops_admin_session=opaque-session");
      assert.equal(call.headers.origin, "https://admin.acornops.dev");
      assert.equal(call.headers["x-csrf-token"], "signed-csrf-token");
      assert.equal(call.headers.authorization, "Bearer secret");
    }
  });
});

test("production gateway rejects identities without an allowed platform-admin role", async () => {
  const fetchImpl = async () => Response.json({
    tokenId: "admin-console-bff",
    scopes: ["admin:self", "admin:workspace:read"],
    adminApiEnabled: true,
    actor: { issuer: "https://idp.example.test", subject: "user-123", roles: ["workspace-owner"] }
  });
  await withServer({ nodeEnv: "production", mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/workspaces`);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "ADMIN_CREDENTIAL_REJECTED");
  });
});

test("mock role management uses producer membership shape and records an admin audit event", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const mutation = await fetch(`${base}/admin-console-api/workspaces/ws_lumen/members/usr_sam/role`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "owner", reason: "Approved role update", ticketRef: "AO-2000" }) });
    assert.equal(mutation.status, 200);
    const member = await mutation.json();
    assert.deepEqual(Object.keys(member).sort(), ["createdAt", "displayName", "email", "role", "updatedAt", "userId", "workspaceId"].sort());
    const user = await fetch(`${base}/admin-console-api/users/usr_sam`).then((result) => result.json());
    assert.equal(user.memberships.find((item) => item.workspaceId === "ws_lumen").role, "owner");
    const events = await fetch(`${base}/admin-console-api/admin-audit-events`).then((result) => result.json());
    assert.equal(events.items[0].reason, "Approved role update");
    assert.equal(events.items[0].metadata.ticketRef, undefined);
    assert.equal(typeof events.items[0].metadata.correlationId, "string");
    assert.equal(events.items[0].adminTokenId, "admin_token_local");
    assert.equal(events.items[0].adminActorSubject, "mock-platform-admin");
  });
});

test("mock membership management permits co-owner removal and protects the remaining owner", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const promote = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members/usr_jules/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner", reason: "Add a second owner" })
    });
    assert.equal(promote.status, 200);

    const removeCoOwner = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members/usr_maya`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Remove one of two owners" })
    });
    assert.equal(removeCoOwner.status, 204);

    const removeLastOwner = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members/usr_jules`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Attempt to remove last owner" })
    });
    assert.equal(removeLastOwner.status, 409);
    assert.equal((await removeLastOwner.json()).error.code, "LAST_OWNER");

    const demoteLastOwner = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members/usr_jules/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin", reason: "Attempt to demote last owner" })
    });
    assert.equal(demoteLastOwner.status, 409);
    assert.equal((await demoteLastOwner.json()).error.code, "LAST_OWNER");
  });
});

test("mock workspace access grant uses an existing user and records an admin audit event", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const mutation = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "usr_sam", role: "auditor", createUserIfMissing: false, reason: "Approved workspace access" })
    });
    assert.equal(mutation.status, 201);
    const member = await mutation.json();
    assert.equal(member.workspaceId, "ws_atlas");
    assert.equal(member.userId, "usr_sam");
    assert.equal(member.role, "auditor");

    const user = await fetch(`${base}/admin-console-api/users/usr_sam`).then((response) => response.json());
    assert.equal(user.memberships.some((item) => item.workspaceId === "ws_atlas" && item.role === "auditor"), true);
    const summary = await fetch(`${base}/admin-console-api/users?q=usr_sam`).then((response) => response.json());
    assert.equal(summary.items[0].workspaceMembershipCount, 2);
    const events = await fetch(`${base}/admin-console-api/admin-audit-events`).then((response) => response.json());
    assert.equal(events.items[0].action, "admin.workspace.member.add");
    assert.equal(events.items[0].adminTokenId, "admin_token_local");
    assert.equal(events.items[0].adminActorSubject, "mock-platform-admin");
    assert.equal(events.items[0].metadata.requestedRole, "auditor");
  });
});

test("workspace access grant cannot create or resolve a user account", async () => {
  let requestedRouteForwarded = false;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/admin/v1/me")) return Response.json({ tokenId: "admin-1", scopes: ["admin:self", "admin:member:write"], adminApiEnabled: true });
    requestedRouteForwarded = true;
    return Response.json({}, { status: 201 });
  };
  await withServer({ mode: "control-plane", upstreamBaseUrl: "https://control.example", upstreamToken: "secret", fetchImpl }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", role: "member", createUserIfMissing: true, reason: "Create account" })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    assert.equal(requestedRouteForwarded, false);
  });
});

test("mock plan and workspace lifecycle mutations accept control-plane field names", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const plan = await fetch(`${base}/admin-console-api/workspaces/ws_lumen/plan`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ planKey: "enterprise", reason: "Approved change", ticketRef: "AO-21" }) });
    assert.equal(plan.status, 200);
    assert.equal((await plan.json()).after.plan.key, "enterprise");
    const suspension = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/suspend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceName: "Atlas Research", reason: "Approved support hold", ticketRef: "AO-22" }) });
    assert.equal(suspension.status, 200);
    assert.equal((await suspension.json()).after.lifecycleStatus, "suspended");
    const restoration = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/restore`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceName: "Atlas Research", reason: "Support hold cleared" }) });
    assert.equal(restoration.status, 200);
    assert.equal((await restoration.json()).after.lifecycleStatus, "active");
  });
});

test("mock plan downgrade and mismatched lifecycle confirmations are rejected", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const plan = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/plan`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ planKey: "starter", reason: "Invalid downgrade" }) });
    assert.equal(plan.status, 400);
    const suspension = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/suspend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceName: "atlas research", reason: "Invalid confirmation" }) });
    assert.equal(suspension.status, 400);
    const restoration = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/restore`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceName: "atlas research", reason: "Invalid confirmation" }) });
    assert.equal(restoration.status, 400);
    const legacyQuota = await fetch(`${base}/admin-console-api/workspaces/ws_atlas/quotas`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ quotas: null, reason: "Not allowlisted" }) });
    assert.equal(legacyQuota.status, 404);
  });
});

test("mock member deletion preserves the producer 204 response contract", async () => {
  await withServer({ mode: "mock" }, async (base) => {
    const response = await fetch(`${base}/admin-console-api/workspaces/ws_lumen/members/usr_sam`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Duplicate access cleanup", ticketRef: "AO-23", replacementOwnerUserId: "usr_maya" })
    });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    const users = await fetch(`${base}/admin-console-api/users`).then((result) => result.json());
    assert.equal(users.items.find((item) => item.id === "usr_sam").workspaceMembershipCount, 0);
    const events = await fetch(`${base}/admin-console-api/admin-audit-events`).then((result) => result.json());
    assert.equal(events.items[0].action, "admin.workspace.member.delete");
    assert.equal(events.items[0].adminTokenId, "admin_token_local");
    assert.equal(events.items[0].adminActorSubject, "mock-platform-admin");
  });
});
