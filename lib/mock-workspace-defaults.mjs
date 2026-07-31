import { randomUUID } from "node:crypto";

export function createMockWorkspaceDefaults(record) {
  const items = [
    {
      id: "def_github_mcp",
      kind: "mcp_server",
      name: "GitHub",
      description: "",
      availableIn: ["agents", "kubernetes", "virtual_machines"],
      enabled: true,
      source: { type: "https", endpoint: "https://api.githubcopilot.com/mcp/" },
      createdAt: "2026-07-10T02:00:00Z",
      updatedAt: "2026-07-10T02:00:00Z"
    },
    {
      id: "def_incident_skill",
      kind: "skill",
      name: "Incident triage",
      description: "Guide structured incident diagnosis.",
      availableIn: ["kubernetes", "virtual_machines"],
      enabled: true,
      source: {
        type: "git",
        provider: "github",
        repoUrl: "https://github.com/acornops/platform-skills",
        ref: "main",
        subpath: "incident-triage",
        commitSha: "0123456789abcdef0123456789abcdef01234567"
      },
      contentDigest: "sha256:mock",
      createdAt: "2026-07-11T02:00:00Z",
      updatedAt: "2026-07-11T02:00:00Z"
    }
  ];

  function execute(method, path, body = {}, query = new URLSearchParams()) {
    if (method === "GET" && path === "/workspace-defaults") {
      const kind = query.get("kind");
      const availableIn = query.get("availableIn");
      const q = String(query.get("q") || "").toLowerCase();
      return ok({
        items: items.filter((item) =>
          (!kind || item.kind === kind)
          && (!availableIn || item.availableIn.includes(availableIn))
          && (!q || `${item.name} ${JSON.stringify(item.source)}`.toLowerCase().includes(q))
        ).map((item) => structuredClone(item))
      });
    }

    if (method === "POST" && path === "/workspace-defaults") {
      const now = new Date().toISOString();
      const item = body.kind === "mcp_server"
        ? {
            id: randomUUID(), kind: body.kind, name: body.name, description: "",
            availableIn: [...body.availableIn], enabled: true, source: structuredClone(body.source),
            configuration: structuredClone(body.configuration), createdAt: now, updatedAt: now
          }
        : {
            id: randomUUID(), kind: body.kind,
            name: skillName(body.files) || "Imported skill",
            description: skillDescription(body.files) || (body.source?.type === "manual" ? "Manual platform skill" : "Imported platform skill"),
            availableIn: [...body.availableIn], enabled: true, source: structuredClone(body.source),
            contentDigest: "sha256:mock", createdAt: now, updatedAt: now
          };
      items.push(item);
      record("admin.system.workspace_default.create", null, "workspace_default", item.id, body, {
        kind: item.kind, availableIn: item.availableIn
      });
      return ok(structuredClone(item), 201);
    }

    const match = /^\/workspace-defaults\/([^/]+)$/.exec(path);
    if (match && method === "PATCH") {
      const item = items.find((candidate) => candidate.id === decodeURIComponent(match[1]));
      if (!item) return notFound();
      if (body.availableIn !== undefined) item.availableIn = [...body.availableIn];
      if (body.enabled !== undefined) item.enabled = body.enabled;
      item.updatedAt = new Date().toISOString();
      record("admin.system.workspace_default.update", null, "workspace_default", item.id, body, {
        kind: item.kind, availableIn: item.availableIn, enabled: item.enabled
      });
      return ok(structuredClone(item));
    }
    if (match && method === "DELETE") {
      const index = items.findIndex((candidate) => candidate.id === decodeURIComponent(match[1]));
      if (index < 0) return notFound();
      const [item] = items.splice(index, 1);
      record("admin.system.workspace_default.delete", null, "workspace_default", item.id, body, {
        kind: item.kind, availableIn: item.availableIn
      });
      return { status: 204, body: null };
    }
    return null;
  }

  return { execute };
}

function skillName(files = []) {
  const skill = files.find((file) => file.path === "SKILL.md");
  return /^name:\s*(.+)$/m.exec(skill?.content || "")?.[1]?.trim();
}
function skillDescription(files = []) {
  const skill = files.find((file) => file.path === "SKILL.md");
  return /^description:\s*(.+)$/m.exec(skill?.content || "")?.[1]?.trim().replace(/^["']|["']$/g, "");
}
function ok(body, status = 200) { return { status, body }; }
function notFound() { return { status: 404, body: { error: { code: "NOT_FOUND", message: "Workspace default not found", retryable: false } } }; }
