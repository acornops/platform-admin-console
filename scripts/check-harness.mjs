import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const expect = (condition, message) => { if (!condition) failures.push(message); };
const includes = (content, needle, label) => expect(content.includes(needle), `${label}: missing ${needle}`);

const requiredFiles = [
  "AGENTS.md", "ARCHITECTURE.md", "PRODUCT.md", "DESIGN.md", "README.md", "package.json", "package-lock.json",
  "docs/index.md", "docs/DEVELOPMENT.md", "docs/OPERATIONS.md", "docs/DESIGN.md", "docs/PLANS.md",
  "docs/AGENT_HANDOFF.md", "docs/QUALITY_SCORE.md", "docs/MAINTAINABILITY.md", "docs/RELIABILITY.md",
  "docs/SECURITY.md", "docs/security-model.md", "docs/design-docs/index.md", "docs/design-docs/core-beliefs.md",
  "docs/product-specs/index.md", "docs/product-specs/component-charter.md", "docs/references/index.md",
  "docs/product-specs/current-requirements.md", "docs/product-specs/requirements-baseline.json",
  "docs/generated/README.md", "docs/exec-plans/active/README.md", "docs/exec-plans/completed/README.md",
  "docs/exec-plans/tech-debt-tracker.md", "docs/contracts/README.md", "docs/contracts/manifest.json",
  ".agents/skills/README.md", ".agents/skills/shared/.standards-version",
  ".agents/skills/local/platform-admin-change/SKILL.md", ".agents/skills/local/platform-admin-change/agents/openai.yaml",
  "scripts/check-requirements.mjs", ".github/workflows/ci.yml", ".github/workflows/release.yml"
];
for (const file of requiredFiles) expect(existsSync(path.join(root, file)), `Missing required harness file ${file}`);

const agents = read("AGENTS.md");
const readme = read("README.md");
const docsIndex = read("docs/index.md");
const development = read("docs/DEVELOPMENT.md");
const operations = read("docs/OPERATIONS.md");
const plans = read("docs/PLANS.md");
const handoff = read("docs/AGENT_HANDOFF.md");
const quality = read("docs/QUALITY_SCORE.md");
const maintainability = read("docs/MAINTAINABILITY.md");
const reliability = read("docs/RELIABILITY.md");
const security = read("docs/SECURITY.md");
const securityModel = read("docs/security-model.md");
const design = read("DESIGN.md");
const designIndex = read("docs/design-docs/index.md");
const productIndex = read("docs/product-specs/index.md");
const currentRequirements = read("docs/product-specs/current-requirements.md");
const requirementsBaseline = JSON.parse(read("docs/product-specs/requirements-baseline.json"));
const localChangeSkill = read(".agents/skills/local/platform-admin-change/SKILL.md");
const localChangeSkillInterface = read(".agents/skills/local/platform-admin-change/agents/openai.yaml");
const packageJson = JSON.parse(read("package.json"));
const ci = read(".github/workflows/ci.yml");
const release = read(".github/workflows/release.yml");
const dockerfile = read("Dockerfile");
const policy = read("lib/admin-route-policy.mjs");
const contractProjection = read("lib/admin-contract.mjs");
const server = read("server.mjs");

expect(agents.split("\n").length <= 140, "AGENTS.md should remain a short entry point");
expect(!agents.includes("/Users/"), "AGENTS.md must not contain workstation-specific paths");
for (const needle of ["ARCHITECTURE.md", "docs/index.md", "docs/DEVELOPMENT.md", "docs/OPERATIONS.md", "docs/contracts/README.md", "docs/product-specs/current-requirements.md", ".agents/skills/local/platform-admin-change/SKILL.md", "requirements baseline", "EXC-*", "BLOCK-*", "DESIGN.md", "docs/PLANS.md", "docs/AGENT_HANDOFF.md", "docs/QUALITY_SCORE.md", "docs/MAINTAINABILITY.md", "docs/RELIABILITY.md", "docs/SECURITY.md", "docs/security-model.md", ".agents/skills/shared", ".agents/skills/local", "Docs impact: none"]) includes(agents, needle, "AGENTS guidance");

for (const needle of ["AGENTS.md", "docs/index.md", "docs/DEVELOPMENT.md", "docs/OPERATIONS.md", "docs/contracts/README.md", "system-architecture.md"]) includes(readme, needle, "README harness link");
for (const needle of ["ARCHITECTURE.md", "system-architecture.md", "DEVELOPMENT.md", "OPERATIONS.md", "contracts/README.md", "design-docs/index.md", "product-specs/index.md", "PLANS.md", "AGENT_HANDOFF.md", "QUALITY_SCORE.md", "MAINTAINABILITY.md", "RELIABILITY.md", "SECURITY.md", "security-model.md"]) includes(docsIndex, needle, "Docs index link");
for (const needle of ["docs/exec-plans/active/README.md", "docs/exec-plans/completed/README.md", "docs/exec-plans/tech-debt-tracker.md"]) includes(plans, needle, "Plans index link");

includes(development, "## Documentation Drift Control", "Development guide");
includes(development, "Docs impact: none", "Development docs-impact rule");
includes(operations, "CONTROL_PLANE_ADMIN_TOKEN", "Operations secret configuration");
includes(quality, "| Area | Score | Evidence | Main Gap |", "Quality score format");
includes(maintainability, "Default source file budget", "Maintainability budget");
includes(maintainability, "npm run harness:check", "Maintainability validation");
includes(reliability, "## Failure Modes", "Reliability failure modes");
includes(reliability, "## Required Validation", "Reliability validation");
includes(security, "## Reporting a Vulnerability", "Security reporting");
includes(security, "https://discord.gg/KHUUdXfsXv", "Security private escalation channel");
for (const needle of ["## Trust Boundaries", "## Secrets", "## High-Risk Changes"]) includes(securityModel, needle, "Security model");
for (const needle of ["exact commands run", "Docs impact: none", "Conventional Commits", "not a GitHub CI gate", "Vendor Neutrality"]) includes(handoff, needle, "Agent handoff");
includes(design, "## Contract Deviation Ledger", "Design deviation tracking");
includes(design, "Any new deviation", "Design deviation policy");
includes(designIndex, "Verified", "Design verification status");
includes(productIndex, "component-charter.md", "Product spec index");
includes(productIndex, "current-requirements.md", "Product spec current requirements link");
includes(productIndex, "requirements-baseline.json", "Product spec executable baseline link");
for (const needle of ["## Authority And Change Protocol", "historical evidence, not current requirements", "## Required Baseline", "## Superseded And Excluded Behavior", "## Contract-Blocked Capabilities", "npm run requirements:check"]) includes(currentRequirements, needle, "Current requirements governance");
expect(requirementsBaseline.authority === "docs/product-specs/current-requirements.md", "Executable requirements authority must be repo-local");
expect(requirementsBaseline.expectedRuntime?.adminRouteCount === 15, "Executable requirements must lock the 15-route consumer subset");
expect(requirementsBaseline.expectedRuntime?.allowedScopeCount === 7, "Executable requirements must lock the 7-scope consumer subset");
expect(requirementsBaseline.required?.length >= 10, "Executable requirements need substantive required behavior coverage");
expect(requirementsBaseline.excluded?.length >= 10, "Executable requirements need substantive superseded-behavior coverage");
expect(requirementsBaseline.blocked?.length >= 4, "Executable requirements need blocked-capability coverage");
for (const needle of ["name: platform-admin-change", "Use for every product, UI, BFF, route, contract, requirement", "Classify the request", "EXC-*", "BLOCK-*", "npm run requirements:check"]) includes(localChangeSkill, needle, "Local platform-admin change skill");
for (const needle of ["display_name: \"Platform Admin Change\"", "short_description:", "$platform-admin-change"]) includes(localChangeSkillInterface, needle, "Local skill interface");

expect(packageJson.name === "@acornops/platform-admin-console", "package name must identify the platform admin console");
expect(packageJson.version === "0.1.0", "release version must remain explicit");
for (const script of ["lint", "test", "test:coverage", "contracts:check", "requirements:check", "harness:check", "build", "smoke:routes", "validate", "validate:ci"]) expect(Boolean(packageJson.scripts?.[script]), `Missing package script ${script}`);
for (const threshold of ["--test-coverage-lines=80", "--test-coverage-branches=65", "--test-coverage-functions=80"]) includes(packageJson.scripts["test:coverage"], threshold, "Coverage threshold");
includes(packageJson.scripts["test:coverage"], "--test-coverage-exclude=public/**", "Coverage runtime scope");
includes(development, "Browser modules are covered by focused UI requirement tests and live-browser verification", "Development coverage boundary");
for (const needle of ["npm test", "npm run contracts:check", "npm run requirements:check", "npm run harness:check", "npm run build", "npm run smoke:routes"]) includes(packageJson.scripts.validate, needle, "Canonical validate script");
includes(packageJson.scripts["validate:ci"], "npm run requirements:check", "Canonical CI validate script");
for (const needle of ["permissions:", "contents: read", "node-version: \"22\"", "npm ci", "npm run validate:ci", "npm audit --omit=dev", "timeout-minutes:"]) includes(ci, needle, "CI workflow");
for (const needle of ["verify-ci:", "packages: write", "package.json", "docker/build-push-action@v6", "provenance: true", "sbom: true"]) includes(release, needle, "Release workflow");
for (const needle of ["FROM node:22-alpine@sha256:", "ENV HOST=0.0.0.0", "USER node"]) includes(dockerfile, needle, "Production image policy");

for (const needle of ["requiredScope", "queryParams", "sanitizedAdminQuery", "/admin/v1/admin-audit-events"]) includes(policy, needle, "Route policy");
for (const needle of ["ALLOWED_ADMIN_SCOPES", "validateAdminIdentity", "projectAdminResponse", "allowedAuditPrefixes", "allowedAuditMetadata"]) includes(contractProjection, needle, "Contract projection");
for (const needle of ["CONTROL_PLANE_ADMIN_TOKEN", "projectAdminResponse", "validateAdminIdentity", "sanitizedAdminQuery", "MAX_BODY_BYTES"]) includes(server, needle, "BFF boundary");
expect(!server.includes("req.body.path") && !server.includes("url.searchParams.get(\"path\")"), "Server must not accept an upstream path from browser input");

function walk(directory) {
  if (!existsSync(path.join(root, directory))) return [];
  const files = [];
  for (const entry of readdirSync(path.join(root, directory))) {
    const relative = path.join(directory, entry);
    const stat = statSync(path.join(root, relative));
    if (stat.isDirectory()) files.push(...walk(relative));
    else if (/\.(?:js|mjs)$/.test(entry)) files.push(relative);
  }
  return files;
}
const budgets = new Map([["public/app.js", 425], ["lib/mock-admin-store.mjs", 400]]);
for (const file of ["server.mjs", ...walk("lib"), ...walk("public"), ...walk("scripts")]) {
  const count = read(file).split("\n").length;
  const budget = budgets.get(file) || 650;
  expect(count <= budget, `${file} has ${count} lines; budget is ${budget}. Extract a focused module.`);
}

for (const metadata of [".DS_Store", ".agents/.DS_Store", ".agents/skills/.DS_Store", ".agents/skills/shared/.DS_Store"]) expect(!existsSync(path.join(root, metadata)), `Remove generated metadata ${metadata}`);
for (const vendor of ["CLAUDE.md", "GEMINI.md", ".cursor", ".cursorrules"]) expect(!existsSync(path.join(root, vendor)), `Do not add required vendor-specific guidance ${vendor}`);

if (failures.length) {
  console.error("Harness checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Harness checks passed (${requiredFiles.length} required files, policy markers, CI, docs, and source budgets).`);
