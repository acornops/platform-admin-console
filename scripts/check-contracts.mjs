import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ADMIN_ROUTE_DEFINITIONS } from "../lib/admin-route-policy.mjs";
import { ALLOWED_ADMIN_SCOPES, FORBIDDEN_ADMIN_SCOPES } from "../lib/admin-contract.mjs";

const root = process.cwd();
const failures = [];
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const expect = (condition, message) => { if (!condition) failures.push(message); };
const includes = (content, needle, label) => expect(content.includes(needle), `${label}: missing ${needle}`);
const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value);

const manifest = json("docs/contracts/manifest.json");
const contract = manifest.counterparts?.["control-plane"];
const docs = read("docs/contracts/README.md");
const design = read("DESIGN.md");
const policy = read("lib/admin-route-policy.mjs");
const projection = read("lib/admin-contract.mjs");
const mock = read("lib/mock-admin-store.mjs");
const browser = read("public/app.js");
const server = read("server.mjs");
const projectionTests = read("test/admin-route-policy.test.mjs");

expect(manifest.repo === "platform-admin-console", "Manifest repo mismatch");
expect(manifest.version === 1, "Manifest version mismatch");
expect(Boolean(contract), "Missing control-plane counterpart contract");
for (const heading of ["# Platform Admin Console Contracts", "## Source Of Truth", "## Full Platform Matrix", "## Platform Dependency Summary", "## Shared Invariants", "## Control-Plane Boundary Notes", "## Change Checklist"]) includes(docs, heading, "Contract documentation");

const runtimePaths = ADMIN_ROUTE_DEFINITIONS.map((route) => `${route.method} ${route.upstreamTemplate
  .replaceAll(":workspaceId", "{workspaceId}")
  .replaceAll(":userId", "{userId}")
  .replaceAll(":settingKey", "{settingKey}")
  .replaceAll(":provider", "{provider}")}`);
expect(stable(runtimePaths) === stable(contract.platformAdminPaths), "Runtime route order or contents differ from mirrored platformAdminPaths");
expect(stable(ALLOWED_ADMIN_SCOPES) === stable(contract.requiredScopes), "Runtime allowed scopes differ from mirrored requiredScopes");
expect(stable(FORBIDDEN_ADMIN_SCOPES) === stable(contract.forbiddenScopes), "Runtime forbidden scopes differ from mirrored forbiddenScopes");
for (const route of ADMIN_ROUTE_DEFINITIONS) {
  expect(route.upstreamTemplate.startsWith("/admin/v1/"), `${route.upstreamTemplate} is outside /admin/v1`);
  expect(contract.requiredScopes.includes(route.requiredScope), `${route.method} ${route.upstreamTemplate} uses undeclared scope ${route.requiredScope}`);
}

for (const forbidden of contract.forbiddenScopes) includes(projection, JSON.stringify(forbidden), "Forbidden scope guard");
for (const token of ["planKey", "kubernetesClusters", "virtualMachines", "displayName", "emailVerified", "workspaceMembershipCount", "occurredAt", "adminTokenId", "nextCursor"]) includes(`${mock}\n${browser}\n${projection}`, token, "Contract field coverage");
includes(policy, "ticketRef", "Producer mutation field coverage");
for (const token of ["sanitizedAdminQuery", "validateAdminIdentity", "projectAdminResponse", "cache-control", "no-store"]) includes(`${server}\n${policy}\n${projection}`, token, "BFF contract enforcement");
for (const token of ["recentRunSummary", "latestWorkspaceAuditAt", "sourceIpHash", "userAgent", "targetId", "targetType"]) includes(`${projection}\n${design}\n${projectionTests}`, token, "Privacy projection decision");
expect(!browser.includes("/admin/v1/"), "Browser code must not call upstream /admin/v1 directly");
expect(!server.includes("/api/v1/") && !server.includes("/internal/v1/"), "BFF must not contain non-admin control-plane paths");

const producerManifestPath = path.resolve(root, "../control-plane/docs/contracts/manifest.json");
if (existsSync(producerManifestPath)) {
  const producer = JSON.parse(readFileSync(producerManifestPath, "utf8"));
  const producerMirror = producer.counterparts?.["platform-admin-console"];
  const available = producer.counterparts?.operators?.adminPaths || [];
  expect(Boolean(producerMirror), "Control-plane manifest is missing platform-admin-console counterpart");
  if (producerMirror) expect(stable(producerMirror) === stable(contract), "Producer and consumer platform-admin counterpart manifests differ");
  for (const route of contract.platformAdminPaths) expect(available.includes(route), `Producer operators.adminPaths does not contain ${route}`);
  for (const denied of ["GET /admin/v1/targets", "GET /admin/v1/runs", "POST /admin/v1/tooling/sync", "GET /admin/v1/audit-events"]) expect(!contract.platformAdminPaths.includes(denied), `Operational producer route was mirrored: ${denied}`);

  const producerSchemas = readFileSync(path.resolve(root, "../control-plane/src/types/contracts.ts"), "utf8");
  const producerAudit = readFileSync(path.resolve(root, "../control-plane/src/store/repository-admin-audit.ts"), "utf8");
  for (const token of ["planKey", "kubernetesClusters", "virtualMachines", "createUserIfMissing", "replacementOwnerUserId", "ticketRef"]) includes(producerSchemas, token, "Producer request schema");
  for (const token of ["adminTokenId", "action", "outcome", "requestId", "metadata", "occurredAt"]) includes(producerAudit, token, "Producer audit runtime");
}

if (failures.length) {
  console.error("Contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Contract checks passed (${runtimePaths.length} routes, ${ALLOWED_ADMIN_SCOPES.length} scopes, producer mirror, DTO fields, and privacy projections).`);
