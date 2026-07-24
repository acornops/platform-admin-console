import assert from "node:assert/strict";
import test from "node:test";
import { filterUsersByWorkspace } from "../public/user-directory.js";

const users = [{ id: "usr_maya" }, { id: "usr_jules" }, { id: "usr_ivy" }];
const workspaces = [{ id: "ws_atlas", name: "Atlas Research" }, { id: "ws_cedar", name: "Cedar Systems" }];
const accessByUser = new Map([
  ["usr_maya", new Set(["ws_atlas"])],
  ["usr_jules", new Set(["ws_cedar", "ws_atlas"])],
  ["usr_ivy", new Set(["ws_cedar"])]
]);

test("workspace user filtering matches free text against names and IDs", () => {
  assert.deepEqual(filterUsersByWorkspace(users, workspaces, accessByUser, "atlas").map((user) => user.id), ["usr_maya", "usr_jules"]);
  assert.deepEqual(filterUsersByWorkspace(users, workspaces, accessByUser, "WS_CEDAR").map((user) => user.id), ["usr_jules", "usr_ivy"]);
  assert.deepEqual(filterUsersByWorkspace(users, workspaces, accessByUser, "missing"), []);
  assert.equal(filterUsersByWorkspace(users, workspaces, accessByUser, ""), users);
});
