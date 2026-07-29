import { createAdminConsoleServer } from "../server.mjs";

const server = createAdminConsoleServer({ mode: "mock" });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
try {
  for (const path of ["/", "/workspaces", "/users", "/settings", "/settings/workspace", "/settings/ai", "/workspace-defaults", "/audit"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    if (!response.ok || !(await response.text()).includes("Platform Admin")) throw new Error(`Static route failed: ${path}`);
  }
  const workspaces = await fetch(`http://127.0.0.1:${port}/admin-console-api/workspaces`);
  if (!workspaces.ok || (await workspaces.json()).items.length < 1) throw new Error("Workspace API smoke failed");
  const forbidden = await fetch(`http://127.0.0.1:${port}/admin-console-api/workspaces/ws_atlas/logs`);
  if (forbidden.status !== 404) throw new Error("Forbidden route was not denied");
  process.stdout.write("Static, API, and denial smoke routes passed.\n");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
