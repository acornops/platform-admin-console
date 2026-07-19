import assert from "node:assert/strict";
import test from "node:test";
import { managementMarkup } from "../public/workspace-access-actions.js";

const workspace = { id: "ws_test", name: "Test Workspace" };
const members = [
  { userId: "usr_owner", displayName: "Olive Owner", email: "owner@example.test", role: "owner" },
  { userId: "usr_member", displayName: "Mina Member", email: "member@example.test", role: "member" }
];

test("workspace access management safeguards only the last owner", () => {
  const markup = managementMarkup(members, workspace, ["owner", "admin", "member"]);
  assert.doesNotMatch(markup, /Add Access|Revoke Non-owner Access/);
  assert.match(markup, /data-member-user-id="usr_owner"[\s\S]+<select[^>]+disabled/);
  assert.match(markup, /aria-label="Revoke Olive Owner's access to Test Workspace" disabled/);
  assert.match(markup, /The last owner must retain access/);
  assert.match(markup, /data-member-user-id="usr_member"[\s\S]+data-update-workspace-role disabled/);
  assert.match(markup, /aria-label="Revoke Mina Member's access to Test Workspace"/);
  assert.match(markup, /aria-label="Role for Mina Member"/);
  assert.doesNotMatch(markup, /Manage workspace access|Add existing users, update roles, or revoke access\.|<label[^>]*>Workspace Role<\/label>/);
  assert.doesNotMatch(markup, /data-user-id=/);
});

test("workspace access management allows either owner to be changed when another owner remains", () => {
  const markup = managementMarkup([
    members[0],
    { userId: "usr_owner_two", displayName: "Otto Owner", email: "otto@example.test", role: "owner" },
    members[1]
  ], workspace, ["owner", "admin", "member"]);
  const ownerRows = markup.match(/<article[^>]+data-current-role="owner"[\s\S]*?<\/article>/g);
  assert.equal(ownerRows.length, 2);
  for (const row of ownerRows) {
    assert.doesNotMatch(row, /<select[^>]+disabled/);
    assert.doesNotMatch(row, /data-revoke-member[^>]+disabled/);
    assert.doesNotMatch(row, /last owner must retain access/);
  }
});
