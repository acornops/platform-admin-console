import assert from "node:assert/strict";
import test from "node:test";
import { getBoundaryEnabledIndex, getNextEnabledIndex } from "../public/menu-controls.js";

const options = [
  { value: "all" },
  { value: "verified", disabled: true },
  { value: "unverified" }
];

test("finds the first and last enabled menu options", () => {
  assert.equal(getBoundaryEnabledIndex(options), 0);
  assert.equal(getBoundaryEnabledIndex(options, "last"), 2);
  assert.equal(getBoundaryEnabledIndex([{ disabled: true }]), -1);
});

test("keyboard navigation wraps and skips disabled options", () => {
  assert.equal(getNextEnabledIndex(options, 0, 1), 2);
  assert.equal(getNextEnabledIndex(options, 2, 1), 0);
  assert.equal(getNextEnabledIndex(options, 0, -1), 2);
  assert.equal(getNextEnabledIndex([], 0, 1), -1);
});
