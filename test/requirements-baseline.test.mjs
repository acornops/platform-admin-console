import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRequirementsBaseline } from "../scripts/check-requirements.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("accepts the checked-in current requirements baseline", () => {
  assert.deepEqual(validateRequirementsBaseline({ root }), []);
});

test("fails when a superseded user workflow is reintroduced", () => {
  const read = (relativePath) => {
    const content = readFileSync(path.join(root, relativePath), "utf8");
    return relativePath === "src/App.tsx" ? `${content}\nconst removedAction = "Revoke active sessions";` : content;
  };
  const failures = validateRequirementsBaseline({ root, read });
  assert.ok(failures.some((failure) => failure.includes("EXC-001") && failure.includes("Revoke active sessions")));
});

test("fails when the runtime route catalog drifts from the accepted subset", () => {
  const extraRoute = { method: "POST", upstreamTemplate: "/admin/v1/users/:userId/sessions/revoke" };
  const failures = validateRequirementsBaseline({ root, routeDefinitions: [...Array(25).fill({}), extraRoute] });
  assert.ok(failures.some((failure) => failure.includes("Expected 25 admin routes, found 26")));
});
