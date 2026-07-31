import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { workspaceDefaultRows } from "../public/workspace-defaults-page.js";
import { matchAdminRoute, sanitizedAdminBody, sanitizedAdminQuery } from "../lib/admin-route-policy.mjs";
import { projectAdminResponse } from "../lib/admin-contract.mjs";

test("renders multi-destination default rows with read-only actions", () => {
  const markup = workspaceDefaultRows([{
    id: "def-1",
    kind: "mcp_server",
    name: "GitHub",
    availableIn: ["kubernetes", "virtual_machines"],
    source: { type: "https", endpoint: "https://mcp.example.test" }
  }], "mcp", false);
  assert.match(markup, /GitHub/);
  assert.match(markup, /Kubernetes/);
  assert.match(markup, /Virtual machines/);
  assert.match(markup, /https:\/\/mcp\.example\.test/);
  assert.match(markup, /data-edit-default="def-1" disabled/);
  assert.doesNotMatch(markup, /credential|secret/i);
});

test("allows only fixed workspace-default filters and mutation fields", () => {
  const list = matchAdminRoute("GET", "/workspace-defaults");
  assert.equal(list.upstreamPath, "/admin/v1/system/workspace-defaults");
  assert.equal(
    sanitizedAdminQuery(list, new URLSearchParams("kind=mcp_server&availableIn=kubernetes&q=github")).toString(),
    "kind=mcp_server&availableIn=kubernetes&q=github"
  );
  assert.equal(sanitizedAdminQuery(list, new URLSearchParams("workspaceId=ws-1")), null);

  const patch = matchAdminRoute("PATCH", "/workspace-defaults/def-1");
  assert.deepEqual(sanitizedAdminBody(patch, {
    availableIn: ["kubernetes", "virtual_machines"],
    reason: "Change destination"
  }), {
    ok: true,
    body: { availableIn: ["kubernetes", "virtual_machines"], reason: "Change destination" }
  });
  assert.equal(sanitizedAdminBody(patch, {
    availableIn: ["agents", "kubernetes", "virtual_machines"],
    endpoint: "https://replacement.example",
    reason: "Attempt source change"
  }).ok, false);
});

test("projects secret-free default metadata and strips imported skill files", () => {
  const route = matchAdminRoute("POST", "/workspace-defaults");
  const projected = projectAdminResponse(route, {
    id: "def-2",
    kind: "skill",
    name: "Incident triage",
    description: "Triage incidents",
    availableIn: ["agents"],
    source: {
      type: "git",
      provider: "github",
      repoUrl: "https://github.com/acornops/skills",
      ref: "main",
      commitSha: "0123456789abcdef0123456789abcdef01234567"
    },
    files: [{ path: "SKILL.md", content: "must-not-return" }],
    contentDigest: "sha256:abc",
    createdAt: "2026-07-29T00:00:00Z",
    updatedAt: "2026-07-29T00:00:00Z"
  });
  assert.equal("files" in projected, false);
  assert.doesNotMatch(JSON.stringify(projected), /must-not-return/);
  assert.equal(projected.source.commitSha, "0123456789abcdef0123456789abcdef01234567");
  assert.deepEqual(projected.availableIn, ["agents"]);
});

test("matches management add actions and keeps MCP creation credential-free", () => {
  const source = readFileSync(new URL("../public/workspace-defaults-page.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(source, /"Capabilities"/);
  assert.match(source, /Choose which capabilities are created in new workspaces\./);
  assert.doesNotMatch(source, /Choose which capabilities are created in new workspaces\. They start disabled\./);
  assert.match(source, /New workspaces are created with these defaults, while existing workspaces remain unchanged\./);
  assert.doesNotMatch(source, /MCP servers are created disabled\./);
  assert.match(source, /Workspace users choose which servers to enable, then configure the appropriate credentials in their workspaces\./);
  assert.match(source, /Workspace users explicitly enable the skills they want to use\./);
  assert.match(html, /data-route="workspace-defaults"[\s\S]+?<span>Capabilities<\/span>/);
  assert.doesNotMatch(`${source}\n${html}`, /MCP &(?:amp;)? Skill Defaults/);
  assert.match(source, /class="button secondary defaults-add-action"/);
  assert.match(source, /<div class="defaults-description-row">[\s\S]+?<p class="defaults-description">[\s\S]+?<div class="defaults-list-action">\$\{addAction\(tab, canMutate\)\}<\/div>\s+<\/div>\s+<div class="ledger defaults-ledger">/);
  assert.doesNotMatch(source, /"Choose which capabilities are created in new workspaces\.",\s+addAction/);
  assert.match(source, /Import skill/);
  assert.match(source, /<p class="defaults-description">/);
  assert.doesNotMatch(source, /defaults-notice|class="defaults-description" role="note"/);
  assert.match(styles, /\.defaults-description-row \{[^}]+display: flex[^}]+justify-content: space-between/);
  assert.match(styles, /\.defaults-description \{[^}]+color: var\(--text-muted\)/);
  assert.match(source, /remain unchanged\.<\/span><span>Workspace users choose which servers/);
  assert.match(source, /remain unchanged\.<\/span><span>Workspace users explicitly enable the skills/);
  assert.match(styles, /\.defaults-description span \{[^}]+white-space: nowrap/);
  assert.match(styles, /@media \(max-width: 1279px\) \{[\s\S]+?\.defaults-description span \{ white-space: normal; \}/);
  assert.doesNotMatch(styles, /\.defaults-description \{[^}]+(?:background|border):/);
  assert.match(source, /Authentication stays in each workspace/);
  assert.match(source, /existing MCP setup/);
  assert.match(source, /data-select-all-destinations/);
  assert.match(source, /getAll\("availableIn"\)/);
  assert.doesNotMatch(source, /authType|authHeader|publicHeaders|Advanced options|name="credential"|name="secret"/);
});

test("uses server-side configured-host resolution from one URL", () => {
  const source = readFileSync(new URL("../public/workspace-defaults-page.js", import.meta.url), "utf8");
  assert.match(source, /workspace-defaults\/resolve-skill/);
  assert.match(source, /Git host configured for this deployment/);
  assert.match(source, /source: \{ type: "git", \.\.\.imported\.source \}/);
  assert.match(source, /files: imported\.files/);
  assert.match(source, /maxlength="2048"/);
  assert.match(source, /aria-describedby="default-repoUrl-help"/);
  assert.match(source, /Provider, ref, and subpath are detected automatically/);
  assert.doesNotMatch(source, /type="file"|Pinned commit SHA|apiBaseUrl|name="provider"|name="ref"|name="subpath"/);
});

test("allows one safe URL through the fixed skill resolver route", () => {
  const route = matchAdminRoute("POST", "/workspace-defaults/resolve-skill");
  assert.equal(route.upstreamPath, "/admin/v1/system/workspace-defaults/resolve-skill");
  assert.deepEqual(sanitizedAdminBody(route, {
    repoUrl: "https://git.example.internal/acornops/skills/tree/main/incident"
  }), {
    ok: true,
    body: { repoUrl: "https://git.example.internal/acornops/skills/tree/main/incident" }
  });
  assert.equal(sanitizedAdminBody(route, { repoUrl: "http://git.example/skill" }).ok, false);
  assert.equal(sanitizedAdminBody(route, { repoUrl: "https://git.example/skill?token=secret" }).ok, false);

  const projected = projectAdminResponse(route, {
    files: [{ path: "SKILL.md", content: "---\nname: triage\n---" }],
    source: {
      provider: "gitlab",
      repoUrl: "https://git.example.internal/acornops/skills",
      ref: "main",
      subpath: "incident",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      apiBaseUrl: "must-not-leak"
    }
  });
  assert.equal(projected.source.provider, "gitlab");
  assert.equal(projected.files[0].path, "SKILL.md");
  assert.equal("apiBaseUrl" in projected.source, false);

  assert.throws(() => projectAdminResponse(route, {
    ...projected,
    files: [{ path: "reference.md", content: "# Reference" }]
  }), /Invalid resolved Git skill response/);
  assert.throws(() => projectAdminResponse(route, {
    ...projected,
    source: { ...projected.source, repoUrl: "https://git.example/skills?token=secret" }
  }), /Invalid resolved Git skill response/);
  assert.throws(() => projectAdminResponse(route, {
    ...projected,
    files: [
      { path: "SKILL.md", content: "---\nname: triage\n---" },
      { path: "SKILL.md", content: "duplicate" }
    ]
  }), /Invalid resolved Git skill response/);
});

test("uses the shared management-style dialog anatomy and buttons", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(html, /class="dialog-heading"[\s\S]+id="dialog-close"[\s\S]+class="dialog-body"[\s\S]+class="dialog-actions"/);
  assert.match(html, /id="dialog-cancel" type="button">Cancel/);
  assert.match(app, /size = "compact", pendingLabel = "Applying…"/);
  assert.match(styles, /dialog\[data-size="form"\]/);
  assert.match(styles, /\.dialog-actions \{[^}]+border-top: 1px solid var\(--border\);[^}]+background: var\(--bg\)/);
  const authenticationNote = styles.match(/\.workspace-auth-note \{([^}]+)\}/)?.[1] || "";
  const authenticationIcon = styles.match(/\.workspace-auth-note-icon \{([^}]+)\}/)?.[1] || "";
  assert.match(authenticationNote, /background: color-mix\(in srgb, var\(--text-muted\)/);
  assert.match(authenticationIcon, /color: var\(--text-muted\)/);
  assert.doesNotMatch(`${authenticationNote}\n${authenticationIcon}`, /admin-accent|brand-orange|danger/);
});

test("rejects empty, duplicate, scalar, and admin-supplied MCP authentication metadata", () => {
  const route = matchAdminRoute("POST", "/workspace-defaults");
  const base = {
    kind: "mcp_server",
    name: "GitHub",
    availableIn: ["agents", "kubernetes"],
    source: { type: "https", endpoint: "https://mcp.example.test" },
    reason: "Approved default"
  };
  assert.deepEqual(sanitizedAdminBody(route, base), {
    ok: true,
    body: base
  });
  for (const availableIn of [[], ["agents", "agents"], "agents", ["unknown"]]) {
    assert.equal(sanitizedAdminBody(route, { ...base, availableIn }).ok, false);
  }
  assert.equal(sanitizedAdminBody(route, { ...base, configuration: { authType: "none" } }).ok, false);
  assert.equal(sanitizedAdminBody(route, {
    ...base,
    authHeaderName: "Authorization"
  }).ok, false);
});

test("does not project upstream MCP authentication metadata to the browser", () => {
  const route = matchAdminRoute("GET", "/workspace-defaults");
  const projected = projectAdminResponse(route, {
    items: [{
      id: "def-auth",
      kind: "mcp_server",
      name: "Private MCP",
      description: "",
      availableIn: ["agents"],
      source: { type: "https", endpoint: "https://mcp.example.test" },
      configuration: {
        authType: "custom_header",
        authHeaderName: "X-API-Key",
        publicHeaders: { "X-Environment": "production" }
      },
      createdAt: "2026-07-29T00:00:00Z",
      updatedAt: "2026-07-29T00:00:00Z"
    }]
  });
  assert.equal("configuration" in projected.items[0], false);
  assert.doesNotMatch(JSON.stringify(projected), /authType|authHeader|publicHeaders/);
});
