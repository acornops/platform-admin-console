import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ALLOWED_ADMIN_SCOPES } from "../lib/admin-contract.mjs";
import { ADMIN_ROUTE_DEFINITIONS } from "../lib/admin-route-policy.mjs";

export function validateRequirementsBaseline({
  root = process.cwd(),
  baseline = JSON.parse(readFileSync(path.join(root, "docs/product-specs/requirements-baseline.json"), "utf8")),
  read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8"),
  exists = (relativePath) => existsSync(path.join(root, relativePath)),
  routeDefinitions = ADMIN_ROUTE_DEFINITIONS,
  allowedScopes = ALLOWED_ADMIN_SCOPES
} = {}) {
  const failures = [];
  const expect = (condition, message) => { if (!condition) failures.push(message); };
  const groups = [
    ["required", "REQ-"],
    ["excluded", "EXC-"],
    ["blocked", "BLOCK-"]
  ];
  const seenIds = new Set();

  expect(baseline.version === 1, "Requirements baseline version must be 1");
  expect(baseline.authority === "docs/product-specs/current-requirements.md", "Requirements authority must remain repo-local");
  expect(routeDefinitions.length === baseline.expectedRuntime?.adminRouteCount, `Expected ${baseline.expectedRuntime?.adminRouteCount} admin routes, found ${routeDefinitions.length}`);
  expect(allowedScopes.length === baseline.expectedRuntime?.allowedScopeCount, `Expected ${baseline.expectedRuntime?.allowedScopeCount} allowed scopes, found ${allowedScopes.length}`);

  for (const source of baseline.normativeSources || []) expect(exists(source), `Missing normative source ${source}`);

  for (const [groupName, prefix] of groups) {
    const entries = baseline[groupName];
    expect(Array.isArray(entries) && entries.length > 0, `Requirements group ${groupName} must not be empty`);
    for (const entry of entries || []) {
      expect(typeof entry.id === "string" && entry.id.startsWith(prefix), `${groupName} requirement has invalid ID ${entry.id || "(missing)"}`);
      expect(!seenIds.has(entry.id), `Duplicate requirement ID ${entry.id}`);
      seenIds.add(entry.id);
      expect(typeof entry.summary === "string" && entry.summary.length >= 20, `${entry.id} needs a meaningful summary`);
      expect(Array.isArray(entry.evidence) && entry.evidence.length > 0, `${entry.id} needs executable evidence`);
      for (const evidence of entry.evidence || []) {
        expect(!evidence.file.startsWith("docs/exec-plans/completed/"), `${entry.id} cannot use a historical execution plan as current evidence`);
        if (!exists(evidence.file)) {
          failures.push(`${entry.id}: missing evidence file ${evidence.file}`);
          continue;
        }
        const content = read(evidence.file);
        for (const needle of evidence.contains || []) expect(content.includes(needle), `${entry.id}: ${evidence.file} is missing required evidence ${needle}`);
        for (const needle of evidence.excludes || []) expect(!content.includes(needle), `${entry.id}: ${evidence.file} reintroduced excluded evidence ${needle}`);
      }
    }
  }

  const authority = exists(baseline.authority) ? read(baseline.authority) : "";
  for (const id of seenIds) expect(authority.includes(`\`${id}\``), `${baseline.authority} must document ${id}`);
  for (const marker of ["## Authority And Change Protocol", "historical evidence, not current requirements", "npm run requirements:check"]) {
    expect(authority.includes(marker), `${baseline.authority} is missing governance marker ${marker}`);
  }

  return failures;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const failures = validateRequirementsBaseline();
  if (failures.length) {
    console.error("Requirements checks failed:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("Requirements checks passed (current, excluded, blocked, runtime counts, and evidence links).");
}
