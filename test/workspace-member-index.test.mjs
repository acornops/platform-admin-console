import assert from "node:assert/strict";
import test from "node:test";
import { loadWorkspaceMembers } from "../public/workspace-member-index.js";

test("workspace member index exhausts the authoritative member cursor and orders by role then identity", async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    if (path === "/workspaces/ws_test/members?limit=100") return {
      items: [
        { workspaceId: "ws_test", userId: "usr_4", displayName: "Alex", email: "alex@example.test", role: "auditor" },
        { workspaceId: "ws_test", userId: "usr_2", displayName: "Zed", email: "zed@example.test", role: "owner" }
      ],
      nextCursor: "next"
    };
    if (path === "/workspaces/ws_test/members?limit=100&cursor=next") return {
      items: [
        { workspaceId: "ws_test", userId: "usr_3", displayName: "Bea", email: "bea@example.test", role: "admin" },
        { workspaceId: "ws_test", userId: "usr_1", displayName: "Aaron", email: "aaron@example.test", role: "member" }
      ]
    };
    throw new Error(`Unexpected path: ${path}`);
  };

  const members = await loadWorkspaceMembers(api, "ws_test");
  assert.deepEqual(members.map((member) => [member.displayName, member.role]), [
    ["Zed", "owner"],
    ["Bea", "admin"],
    ["Aaron", "member"],
    ["Alex", "auditor"]
  ]);
  assert.deepEqual(calls, [
    "/workspaces/ws_test/members?limit=100",
    "/workspaces/ws_test/members?limit=100&cursor=next"
  ]);
});
