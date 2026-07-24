import assert from "node:assert/strict";
import test from "node:test";
import { buildOverviewModel, overviewMarkup } from "../public/overview-view.js";

const workspaces = [
  { id: "ws_atlas", name: "Atlas", memberCount: 4, clusterCount: 3, virtualMachineCount: 1, lifecycleStatus: "active" },
  { id: "ws_cedar", name: "Cedar", memberCount: 2, clusterCount: 1, virtualMachineCount: 0, lifecycleStatus: "suspended" },
  { id: "ws_lumen", name: "Lumen", memberCount: 1, clusterCount: 0, virtualMachineCount: 1, lifecycleStatus: "active" }
];
const users = [{ emailVerified: true }, { emailVerified: true }, { emailVerified: false }];
test("builds product metrics only from governance-safe portfolio fields", () => {
  const model = buildOverviewModel({ workspaces, users });
  assert.deepEqual(model.environmentLeaders.map(({ name, environmentCount }) => [name, environmentCount]), [["Atlas", 4], ["Cedar", 1], ["Lumen", 1]]);
  assert.equal(model.environmentCount, 6);
  assert.equal(model.verifiedPercent, 67);
  assert.equal(model.suspendedWorkspaceCount, 1);
});

test("renders a product portfolio report while preserving the data boundary", () => {
  const markup = overviewMarkup({ workspaces, users, pageHeader: (title, description) => `<header><h1>${title}</h1><p>${description}</p></header>` });
  assert.match(markup, /Platform insights/);
  assert.match(markup, /Platform footprint/);
  assert.doesNotMatch(markup, /class="status ok"|>Ok<|readiness/);
  assert.match(markup, /Most connected environments/);
  assert.match(markup, /1 suspended workspace/);
  assert.match(markup, /1 of 3 workspaces has suspended member access/);
  assert.match(markup, /Review workspaces →/);
  assert.doesNotMatch(markup, /Review lifecycle/);
  assert.match(markup, /4 total \(3 clusters · 1 VM\)/);
  assert.match(markup, /Product signals/);
  assert.match(markup, /Connected environments/);
  assert.match(markup, /No workspace logs or tenant audit events/);
  assert.match(markup, /<aside class="overview-boundary"[^>]*><svg[^>]*>.*<rect width="18" height="11"/s);
  assert.doesNotMatch(markup, /Access assignments|Most users with access|Privileged changes recorded|What merits attention now/);
  assert.doesNotMatch(markup, /run volume|deployment count|compute hours|active sessions/i);
});
