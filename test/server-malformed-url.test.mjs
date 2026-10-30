import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";

// A child process proves that errors in the response-finish listener cannot kill
// the production server. All credentials and upstream calls are synthetic.
async function withChildServer(t, run) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", `
    import { createAdminConsoleServer } from ${JSON.stringify(new URL("../server.mjs", import.meta.url).href)};
    const server = createAdminConsoleServer({
      nodeEnv: "production", mode: "control-plane",
      upstreamBaseUrl: "https://fixture.invalid", upstreamToken: "fixture-only",
      fetchImpl: async () => { process.send({ upstream: true }); throw new Error("Unexpected upstream call"); }
    });
    server.prependListener("request", (request) => {
      if (request.url === "/__fixture/invalid-url") request.url = "http://[";
    });
    server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
  `], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let logs = "";
  let upstreamCalls = 0;
  child.stdout.on("data", (data) => { logs += data; });
  child.stderr.on("data", (data) => { logs += data; });
  child.on("message", (message) => { if (message.upstream) upstreamCalls++; });
  const exited = once(child, "exit");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exited;
  });
  const [ready] = await once(child, "message", { signal: AbortSignal.timeout(5000) });
  await run(ready.port);
  assert.equal(child.exitCode, null, logs);
  assert.equal(upstreamCalls, 0);
  assert.doesNotMatch(logs, /secret-marker|%ZZ|%E0%A4%A|%C0%AF/);
  return logs;
}

function request(port, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method, agent: false }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(3000, () => req.destroy(new Error("Fixture request timed out")));
    req.end();
  });
}

test("malformed routes cannot terminate the production BFF", { timeout: 15000 }, async (t) => {
  const logs = await withChildServer(t, async (port) => {
    for (const id of ["%", "%ZZ", "%2", "%E0%A4%A", "%C0%AF"]) {
      for (const [method, path] of [
        ["GET", `/workspaces/${id}`],
        ["PATCH", `/workspaces/ws-1/members/${id}/role`]
      ]) {
        const response = await request(port, `/admin-console-api${path}?code=secret-marker`, method);
        assert.equal(response.status, 404);
        assert.equal(response.body.error.code, "ADMIN_ROUTE_NOT_ALLOWED");
        assert.equal((await request(port, "/health/live")).status, 200);
      }
    }
  });
  assert.match(logs, /"route":"\/admin-console-api\/denied"/);
});

test("access-log URL classification failures cannot escape the finish callback", { timeout: 10000 }, async (t) => {
  const logs = await withChildServer(t, async (port) => {
    assert.equal((await request(port, "/__fixture/invalid-url")).status, 500);
    assert.equal((await request(port, "/health/live")).status, 200);
  });
  assert.match(logs, /"route":"\/invalid-request"/);
});
