import assert from "node:assert/strict";
import test from "node:test";
import { auditActorName, auditAffectedMarkup, auditAffectedText, auditPresetRange, buildAuditQuery, rawAuditKeyValues } from "../public/audit-page.js";

test("builds a complete allowlisted admin audit query and omits empty filters", () => {
  const query = buildAuditQuery({
    action: "admin.workspace.member.add",
    workspaceId: " ws_atlas ",
    adminActorSubject: "mock-platform-admin",
    outcome: "success",
    ignoredEmptyValue: ""
  }, "2026-07-13T00:00", "2026-07-17T23:59");
  assert.equal(query.get("action"), "admin.workspace.member.add");
  assert.equal(query.get("workspaceId"), "ws_atlas");
  assert.equal(query.get("adminActorSubject"), "mock-platform-admin");
  assert.equal(query.get("outcome"), "success");
  assert.match(query.get("from"), /^2026-07-1[23]T/);
  assert.match(query.get("to"), /^2026-07-1[78]T/);
  assert.equal(query.has("ignoredEmptyValue"), false);
});

test("calculates every supported audit time preset from a stable local instant", () => {
  const current = new Date(2026, 6, 17, 15, 30, 0);
  const today = auditPresetRange("today", current);
  assert.equal(today.from.getHours(), 0);
  assert.equal(today.from.getMinutes(), 0);
  assert.equal(today.now.getTime(), current.getTime());
  assert.equal((current.getTime() - auditPresetRange("24h", current).from.getTime()) / 3_600_000, 24);
  assert.equal(auditPresetRange("7d", current).from.getDate(), 10);
  assert.equal(auditPresetRange("30d", current).from.getMonth(), 5);
  assert.throws(() => auditPresetRange("90d", current), /Unsupported audit time preset/);
});

test("formats every projected audit field as copyable event data", () => {
  const raw = rawAuditKeyValues({
    id: "event-1", action: "admin.workspace.member.add", outcome: "success", workspaceId: "ws_atlas",
    requestId: "req-1", reason: "Access review", metadata: { correlationId: "corr-1", ticketRef: "hidden", requestedRole: "member", nested: { safe: true } }
  });
  assert.match(raw, /^id: event-1$/m);
  assert.match(raw, /^action: admin\.workspace\.member\.add$/m);
  assert.match(raw, /^outcome: success$/m);
  assert.match(raw, /^workspaceId: ws_atlas$/m);
  assert.match(raw, /^reason: Access review$/m);
  assert.match(raw, /^requestId: req-1$/m);
  assert.match(raw, /^correlationId: corr-1$/m);
  assert.match(raw, /^requestedRole: member$/m);
  assert.match(raw, /^nested: \{"safe":true\}$/m);
  assert.doesNotMatch(raw, /ticketRef/);
  assert.doesNotMatch(raw, /undefined|null/);
});

test("shows one readable human administrator value in the actor column", () => {
  assert.equal(auditActorName({ adminActorDisplayName: "Avery Admin", adminActorEmail: "avery@example.test", adminActorSubject: "admin-42", adminActorRole: "platform-admin" }), "Avery Admin");
  assert.equal(auditActorName({ adminActorEmail: "avery@example.test", adminActorSubject: "admin-42" }), "avery@example.test");
  assert.equal(auditActorName({ adminActorSubject: "admin-42" }), "admin-42");
  assert.equal(auditActorName({}), "Unknown administrator");
});

test("shows workspace names in audit objects while retaining ID fallback", () => {
  const named = { workspaceId: "ws_atlas", workspaceName: "Atlas Research", subjectType: "user", subjectId: "usr_ivy" };
  assert.match(auditAffectedMarkup(named), /<strong>Atlas Research<\/strong>/);
  assert.doesNotMatch(auditAffectedMarkup(named), />ws_atlas</);
  assert.equal(auditAffectedText(named), "Workspace Atlas Research · User usr_ivy");
  assert.match(auditAffectedMarkup({ workspaceId: "ws_atlas" }), /<strong>ws_atlas<\/strong>/);
  assert.equal(auditAffectedText({ workspaceId: "ws_atlas" }), "Workspace ws_atlas");
});
