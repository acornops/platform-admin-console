import assert from "node:assert/strict";
import test from "node:test";
import { workspaceMemberTableMarkup, workspacePanelMarkup } from "../public/workspace-panel-view.js";

const workspace = {
  id: "ws_test",
  name: "Test Workspace",
  plan: { key: "team", name: "Team" },
  createdBy: "usr_test",
  createdAt: "2026-01-01T00:00:00Z",
  clusterCount: 4,
  virtualMachineCount: 2,
  memberCount: 4,
  lifecycleStatus: "active"
};
const plans = [{ key: "team", name: "Team", quotas: { members: 15, kubernetesClusters: 10, virtualMachines: 5 } }];

test("workspace details show plan-derived governance counts without quota controls", () => {
  const markup = workspacePanelMarkup(workspace, plans);
  assert.match(markup, /aria-label="4 of 10 connected">4 \/ 10<\/span>/);
  assert.match(markup, /aria-label="2 of 5 connected">2 \/ 5<\/span>/);
  assert.match(markup, /capacity-badge within-limit/);
  assert.match(markup, />4 members</);
  assert.match(markup, /data-change-plan>Change Plan/);
  assert.match(markup, /data-manage-workspace-access aria-pressed="false">Manage Access/);
  assert.match(markup, /data-add-workspace-access data-tooltip="Add workspace access" aria-label="Add workspace access" hidden/);
  assert.match(markup, /<dd class="workspace-plan-value"><span>Team<\/span><button[^>]+data-change-plan>Change Plan<\/button><\/dd>/);
  assert.ok(markup.indexOf("Kubernetes clusters") < markup.indexOf("Virtual machines"));
  assert.ok(markup.indexOf("Virtual machines") < markup.indexOf("Current plan"));
  assert.ok(markup.indexOf("Current plan") < markup.indexOf("data-change-plan"));
  assert.doesNotMatch(markup, /Quota Usage|Quota policy|Adjust Quotas|Manage Workspace/);
});

test("workspace lifecycle renders suspension and restoration actions", () => {
  assert.match(workspacePanelMarkup(workspace), /workspace-lifecycle-status active">Active<\/span>/);
  assert.match(workspacePanelMarkup(workspace), /data-workspace-lifecycle="suspend">Suspend Workspace/);
  assert.match(workspacePanelMarkup({ ...workspace, lifecycleStatus: "suspended" }), /workspace-lifecycle-status suspended">Suspended<\/span>/);
  assert.match(workspacePanelMarkup({ ...workspace, lifecycleStatus: "suspended" }), /data-workspace-lifecycle="restore">Restore Workspace/);
  assert.match(workspacePanelMarkup(workspace), /does not stop or modify workloads/);
  assert.match(workspacePanelMarkup(workspace), /workspace-lifecycle-copy">Suspend member access while retaining memberships, targets, workloads, references, and audit history\.<\/p>/);
});

test("workspace member table shows names, emails, roles, and filtered management links", () => {
  const markup = workspaceMemberTableMarkup([
    { workspaceId: "ws_test", userId: "usr_1", displayName: "Alex Tan", email: "alex@example.test", role: "workspace_admin" }
  ], workspace);
  assert.match(markup, />Alex Tan</);
  assert.match(markup, />alex@example\.test</);
  assert.match(markup, />Workspace Admin</);
  assert.match(markup, /href="\/users\/usr_1\?workspace=Test%20Workspace"/);
});
