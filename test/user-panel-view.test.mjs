import assert from "node:assert/strict";
import test from "node:test";
import { userPanelMarkup } from "../public/user-panel-view.js";

const user = { id: "usr_test", createdAt: "2025-01-01T00:00:00Z" };
const workspaces = [{ id: "ws_test", name: "Test Workspace" }];

test("keeps membership lifecycle metadata beneath the role control and hides a redundant update date", () => {
  const markup = userPanelMarkup({ user, authMethods: [], memberships: [{ workspaceId: "ws_test", role: "member", createdAt: "2025-08-11T00:00:00Z", updatedAt: "2025-08-11T09:30:00Z" }] }, ["member", "admin"], workspaces);
  assert.ok(markup.indexOf("membership-role-control") < markup.indexOf("membership-meta"));
  assert.match(markup, /data-membership-added>Aug 11, 2025<\/time>/);
  assert.match(markup, /data-membership-updated-item hidden/);
});

test("shows an updated date when it differs from the added date", () => {
  const markup = userPanelMarkup({ user, authMethods: [], memberships: [{ workspaceId: "ws_test", role: "member", createdAt: "2025-08-11T00:00:00Z", updatedAt: "2026-07-17T00:00:00Z" }] }, ["member", "admin"], workspaces);
  assert.doesNotMatch(markup, /data-membership-updated-item hidden/);
  assert.match(markup, /data-membership-updated>Jul 17, 2026<\/time>/);
});
