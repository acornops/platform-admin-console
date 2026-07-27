import assert from "node:assert/strict";
import test from "node:test";
import { workspaceRows } from "../public/workspace-directory.js";

const baseWorkspace = {
  id: "ws_test",
  name: "Test Workspace",
  plan: { key: "team", name: "Team" },
  createdBy: "usr_test",
  createdAt: "2026-01-01T00:00:00Z",
  lifecycleStatus: "active",
  quota: {
    members: { used: 4, limit: 5 },
    kubernetesClusters: { used: 2, limit: 3 },
    virtualMachines: { used: 0, limit: 1 }
  }
};

test("workspace rows show lifecycle posture without plan or quota policy", () => {
  const rows = workspaceRows([{ ...baseWorkspace, createdByDisplayName: "Maya Chen", createdByEmail: "maya@example.test", memberCount: 4 }], "ws_test");
  assert.match(rows, /data-workspace-id="ws_test"/);
  assert.match(rows, /aria-selected="true"/);
  assert.match(rows, />4<\/td>/);
  assert.match(rows, /workspace-directory-status active">Active<\/span>/);
  assert.match(rows, />Maya Chen<\/td>/);
  assert.doesNotMatch(rows, />usr_test<\/td>/);
  assert.match(workspaceRows([{ ...baseWorkspace, memberCount: 4, lifecycleStatus: "suspended" }]), /workspace-directory-status suspended">Suspended<\/span>/);
  assert.doesNotMatch(rows, /Team|Within limits|Over limit|quota-status/);
});

test("workspace rows fall back from creator display name to email and immutable ID", () => {
  assert.match(workspaceRows([{ ...baseWorkspace, createdByEmail: "maya@example.test", memberCount: 4 }]), />maya@example\.test<\/td>/);
  assert.match(workspaceRows([{ ...baseWorkspace, memberCount: 4 }]), />usr_test<\/td>/);
});
