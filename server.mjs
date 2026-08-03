import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ADMIN_ROUTE_DEFINITIONS, isGovernanceOnlyUpstreamPath, matchAdminRoute, sanitizedAdminBody, sanitizedAdminQuery } from "./lib/admin-route-policy.mjs";
import { projectAdminResponse, validateAdminIdentity } from "./lib/admin-contract.mjs";
import { createMockAdminStore } from "./lib/mock-admin-store.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const staticRoot = join(root, "dist");
const API_PREFIX = "/admin-console-api";
const ADMIN_AUTH_PREFIX = "/admin-auth";
const ADMIN_AUTH_ROUTE_DEFINITIONS = Object.freeze([
  Object.freeze({ method: "GET", path: "/admin-auth/oidc/login", query: Object.freeze(["return_to", "reauthenticate"]) }),
  Object.freeze({ method: "GET", path: "/admin-auth/oidc/callback", query: Object.freeze(["code", "state", "iss", "session_state"]) }),
  Object.freeze({ method: "GET", path: "/admin-auth/csrf", query: Object.freeze([]) }),
  Object.freeze({ method: "POST", path: "/admin-auth/logout", query: Object.freeze([]) })
]);
const MAX_BODY_BYTES = 196_608;
const SECURITY_HEADERS = Object.freeze({
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com https://gitlab.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
});
const DEVELOPMENT_SECURITY_HEADERS = Object.freeze({
  ...SECURITY_HEADERS,
  "content-security-policy": SECURITY_HEADERS["content-security-policy"]
    .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
});

export { ADMIN_ROUTE_DEFINITIONS, matchAdminRoute };

export function createAdminConsoleServer(options = {}) {
  const mode = options.mode || process.env.ADMIN_CONSOLE_DATA_MODE || "mock";
  const developmentMode = options.developmentMode === true;
  const requireHumanIdentity = (options.nodeEnv || process.env.NODE_ENV) === "production";
  if (requireHumanIdentity && mode !== "control-plane") {
    throw new Error("Production platform admin console requires ADMIN_CONSOLE_DATA_MODE=control-plane");
  }
  const upstreamBaseUrl = options.upstreamBaseUrl || process.env.CONTROL_PLANE_ADMIN_BASE_URL || "";
  const upstreamToken = options.upstreamToken || process.env.CONTROL_PLANE_ADMIN_TOKEN || "";
  const mockStore = options.mockStore || createMockAdminStore();
  const fetchImpl = options.fetchImpl || configuredUpstreamFetch();
  // The workload credential is process-wide, but human identity is not. Cache
  // only workload scopes; user identity remains isolated in the control-plane
  // session carried by each browser request.
  const credentialState = { scopes: null };
  let viteDevServerPromise;
  let server;

  server = createServer(async (request, response) => {
    const startedAt = process.hrtime.bigint();
    const requestId = safeRequestId(request.headers["x-request-id"]);
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    response.once("finish", () => logRequest({ request, response, requestId, startedAt }));
    try {
      setHeaders(response, developmentMode ? DEVELOPMENT_SECURITY_HEADERS : SECURITY_HEADERS);
      const url = new URL(request.url || "/", "http://console.local");
      if (url.pathname === "/health/live") {
        if (request.method !== "GET") {
          sendJson(response, 405, apiError("METHOD_NOT_ALLOWED", "Method not allowed"));
          return;
        }
        sendJson(response, 200, { status: "ok", service: "platform-admin-console" });
        return;
      }
      if (url.pathname === "/health/ready") {
        if (request.method !== "GET") {
          sendJson(response, 405, apiError("METHOD_NOT_ALLOWED", "Method not allowed"));
          return;
        }
        await handleReadiness({ response, mode, upstreamBaseUrl, upstreamToken, fetchImpl });
        return;
      }
      if (url.pathname === ADMIN_AUTH_PREFIX || url.pathname.startsWith(`${ADMIN_AUTH_PREFIX}/`)) {
        await handleAdminAuth({ request, response, url, mode, upstreamBaseUrl, fetchImpl, requestId });
        return;
      }
      if (url.pathname.startsWith(API_PREFIX)) {
        await handleApi({ request, response, url, mode, upstreamBaseUrl, upstreamToken, mockStore, fetchImpl, credentialState, requireHumanIdentity });
        return;
      }
      if (!["GET", "HEAD"].includes(request.method || "GET")) {
        sendJson(response, 405, apiError("METHOD_NOT_ALLOWED", "Method not allowed"));
        return;
      }
      if (developmentMode) {
        viteDevServerPromise ||= createViteDevServer(server);
        const viteDevServer = await viteDevServerPromise;
        viteDevServer.middlewares(request, response, (error) => {
          if (error) {
            if (response.headersSent) response.destroy(error);
            else sendJson(response, 500, apiError("DEVELOPMENT_ASSET_FAILED", "Development asset request failed"));
          } else if (!response.writableEnded) {
            sendJson(response, 404, apiError("NOT_FOUND", "Not found"));
          }
        });
        return;
      }
      await serveStatic(response, url.pathname);
    } catch (error) {
      sendJson(response, error?.statusCode || 500, apiError(error?.publicCode || "REQUEST_FAILED", error?.publicMessage || "Request failed"));
    }
  });

  server.once("close", () => {
    if (viteDevServerPromise) void viteDevServerPromise.then((viteDevServer) => viteDevServer.close()).catch(() => {});
  });
  return server;
}

async function createViteDevServer(server) {
  const { createServer: createViteServer } = await import("vite");
  return createViteServer({
    root,
    appType: "spa",
    server: {
      middlewareMode: { server },
      watch: process.env.CHOKIDAR_USEPOLLING === "true" ? { usePolling: true } : undefined
    },
    resolve: {
      alias: [{ find: /^@acornops\/ui$/, replacement: join(root, "packages/ui/src/index.ts") }]
    }
  });
}

async function handleAdminAuth({ request, response, url, mode, upstreamBaseUrl, fetchImpl, requestId }) {
  setHeaders(response, { "cache-control": "no-store" });
  const pathDefinition = ADMIN_AUTH_ROUTE_DEFINITIONS.find((definition) => definition.path === url.pathname);
  if (!pathDefinition) {
    sendJson(response, 404, apiError("ADMIN_AUTH_ROUTE_NOT_ALLOWED", "The requested authentication route is not available"));
    return;
  }
  if (pathDefinition.method !== request.method) {
    response.setHeader("allow", pathDefinition.method);
    sendJson(response, 405, apiError("METHOD_NOT_ALLOWED", "Method not allowed"));
    return;
  }
  if ([...url.searchParams.keys()].some((name) => !pathDefinition.query.includes(name))) {
    sendJson(response, 400, apiError("VALIDATION_ERROR", "Query parameter is not allowed for this authentication route"));
    return;
  }
  if (mode !== "control-plane" || !upstreamBaseUrl) {
    sendJson(response, 503, apiError("ADMIN_UPSTREAM_NOT_CONFIGURED", "The admin control plane is not configured"));
    return;
  }

  const result = await callAdminAuthUpstream({
    path: pathDefinition.path,
    method: pathDefinition.method,
    query: url.searchParams,
    upstreamBaseUrl,
    fetchImpl,
    browserRequest: request
  });
  if (result.error) {
    if (isAdminSignInNavigation(pathDefinition.path)) {
      sendAdminSignInUnavailable(response, result.status, requestId, true, url.searchParams.get("return_to"));
      return;
    }
    sendJson(response, result.status, result.error);
    return;
  }
  if (result.status >= 500 && isAdminSignInNavigation(pathDefinition.path)) {
    const upstreamFailure = parseAdminAuthFailure(result);
    sendAdminSignInUnavailable(
      response,
      result.status,
      upstreamFailure.requestId || requestId,
      upstreamFailure.retryable,
      url.searchParams.get("return_to")
    );
    return;
  }
  if (result.setCookies.length) response.setHeader("set-cookie", result.setCookies);
  if (result.location) response.setHeader("location", result.location);
  if (result.contentType) response.setHeader("content-type", result.contentType);
  response.writeHead(result.status);
  response.end(result.body);
}

function isAdminSignInNavigation(path) {
  return path === "/admin-auth/oidc/login" || path === "/admin-auth/oidc/callback";
}

function parseAdminAuthFailure(result) {
  if (!result.contentType.includes("application/json")) return { retryable: true, requestId: "" };
  try {
    const payload = JSON.parse(result.body.toString("utf8"));
    return {
      retryable: payload?.error?.retryable !== false,
      requestId: typeof payload?.error?.request_id === "string" ? payload.error.request_id : ""
    };
  } catch {
    return { retryable: true, requestId: "" };
  }
}

function sendAdminSignInUnavailable(response, status, requestId, retryable, returnTo) {
  const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const retryUrl = `/admin-auth/oidc/login?return_to=${encodeURIComponent(safeReturnTo)}`;
  const title = retryable ? "Admin sign-in is temporarily unavailable" : "Admin sign-in is unavailable";
  const guidance = retryable
    ? "The identity service could not be reached. Try again in a moment."
    : "The identity service is not configured correctly. Contact your platform operator.";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign-in unavailable · AcornOps</title>
  <link rel="stylesheet" href="/auth-unavailable.css">
</head>
<body>
  <main class="auth-error-card" aria-labelledby="auth-error-title">
    <div class="auth-error-mark" aria-hidden="true">A</div>
    <p class="auth-error-eyebrow">AcornOps Platform Admin</p>
    <h1 id="auth-error-title">${title}</h1>
    <p>${guidance}</p>
    <div class="auth-error-actions">
      ${retryable ? `<a class="auth-error-primary" href="${retryUrl}">Try again</a>` : ""}
      <a class="auth-error-secondary" href="/">Return to console</a>
    </div>
    <p class="auth-error-request">Request ID: <code>${escapeHtml(requestId)}</code></p>
  </main>
</body>
</html>`;
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

async function handleReadiness({ response, mode, upstreamBaseUrl, upstreamToken, fetchImpl }) {
  setHeaders(response, { "cache-control": "no-store" });
  if (mode === "mock") {
    sendJson(response, 200, { status: "ok", mode: "mock" });
    return;
  }
  if (mode !== "control-plane" || !upstreamBaseUrl || !upstreamToken) {
    sendJson(response, 503, { status: "degraded", mode, upstream: "not_configured" });
    return;
  }
  const result = await callAdminUpstream({
    path: "/ready",
    method: "GET",
    query: new URLSearchParams(),
    upstreamBaseUrl,
    upstreamToken,
    fetchImpl
  });
  const ready = result.status >= 200 && result.status < 300;
  sendJson(response, ready ? 200 : 503, {
    status: ready ? "ok" : "degraded",
    mode: "control-plane",
    upstream: ready ? "ok" : "down"
  });
}

function configuredUpstreamFetch() {
  const caPath = process.env.CONTROL_PLANE_ADMIN_TLS_CA_FILE || "";
  const certPath = process.env.CONTROL_PLANE_ADMIN_TLS_CERT_FILE || "";
  const keyPath = process.env.CONTROL_PLANE_ADMIN_TLS_KEY_FILE || "";
  if (!caPath && !certPath && !keyPath) return globalThis.fetch;
  if (!caPath || Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error("Admin control-plane TLS requires a CA file and both or neither client certificate files");
  }
  return createTlsFetch({
    ca: readFileSync(caPath),
    ...(certPath ? { cert: readFileSync(certPath), key: readFileSync(keyPath) } : {})
  });
}

function createTlsFetch(tls) {
  return (url, options = {}) => new Promise((resolve, reject) => {
    const target = url instanceof URL ? url : new URL(url);
    if (target.protocol !== "https:") { reject(new Error("Configured admin upstream TLS requires an HTTPS URL")); return; }
    const outgoing = httpsRequest(target, {
      method: options.method || "GET",
      headers: options.headers,
      signal: options.signal,
      ...tls
    }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) headers.append(name, String(item));
        }
        const status = incoming.statusCode || 502;
        resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers }));
      });
    });
    outgoing.on("error", reject);
    if (options.body) outgoing.write(options.body);
    outgoing.end();
  });
}

async function handleApi(context) {
  const { request, response, url, mode, upstreamBaseUrl, upstreamToken, mockStore, fetchImpl, credentialState, requireHumanIdentity } = context;
  setHeaders(response, { "cache-control": "no-store" });
  const browserPath = url.pathname.slice(API_PREFIX.length) || "/";
  if (browserPath === "/auth/csrf" && request.method === "GET") {
    if (mode === "mock") {
      sendJson(response, 200, { csrfToken: "mock-admin-csrf" });
      return;
    }
    if (mode !== "control-plane" || !upstreamBaseUrl || !upstreamToken) {
      sendJson(response, 503, apiError("ADMIN_UPSTREAM_NOT_CONFIGURED", "The admin control plane is not configured"));
      return;
    }
    const result = await callAdminAuthUpstream({
      path: "/admin-auth/csrf",
      method: "GET",
      query: new URLSearchParams(),
      upstreamBaseUrl,
      fetchImpl,
      browserRequest: request
    });
    if (result.error) {
      sendJson(response, result.status, result.error);
      return;
    }
    if (result.setCookies.length) response.setHeader("set-cookie", result.setCookies);
    if (!result.contentType.includes("application/json")) {
      sendJson(response, 502, apiError("INVALID_UPSTREAM_RESPONSE", "The admin control plane returned an invalid response"));
      return;
    }
    try {
      sendJson(response, result.status, JSON.parse(result.body.toString("utf8")));
    } catch {
      sendJson(response, 502, apiError("INVALID_UPSTREAM_RESPONSE", "The admin control plane returned an invalid response"));
    }
    return;
  }
  const matched = matchAdminRoute(request.method, browserPath);
  if (!matched || !isGovernanceOnlyUpstreamPath(matched.upstreamPath)) {
    sendJson(response, 404, apiError("ADMIN_ROUTE_NOT_ALLOWED", "The requested route is not available to the platform admin console"));
    return;
  }
  const safeQuery = sanitizedAdminQuery(matched, url.searchParams);
  if (!safeQuery) {
    sendJson(response, 400, { error: { code: "VALIDATION_ERROR", message: "Query parameter is not allowed for this admin route", retryable: false } });
    return;
  }

  const requestBody = ["POST", "PATCH", "PUT", "DELETE"].includes(request.method || "") ? await readJsonBody(request) : {};
  const safeBody = sanitizedAdminBody(matched, requestBody);
  if (!safeBody.ok) {
    sendJson(response, 400, { error: { code: "VALIDATION_ERROR", message: safeBody.message, retryable: false } });
    return;
  }
  const body = safeBody.body;
  if (mode === "mock") {
    const result = mockStore.execute(request.method || "GET", browserPath, body, safeQuery);
    sendApiResult(response, matched, result.status, result.body);
    return;
  }

  if (mode !== "control-plane" || !upstreamBaseUrl || !upstreamToken) {
    sendJson(response, 503, apiError("ADMIN_UPSTREAM_NOT_CONFIGURED", "The admin control plane is not configured"));
    return;
  }

  let upstreamResult;
  if (!credentialState.scopes) {
    const identityResult = await callAdminUpstream({ path: "/admin/v1/me", method: "GET", query: new URLSearchParams(), upstreamBaseUrl, upstreamToken, fetchImpl, browserRequest: request });
    if (identityResult.status < 200 || identityResult.status >= 300) {
      sendJson(response, identityResult.status, identityResult.payload);
      return;
    }
    const validation = validateAdminIdentity(identityResult.payload, { requireHumanIdentity });
    if (!validation.ok) {
      sendJson(response, 403, { error: { code: "ADMIN_CREDENTIAL_REJECTED", message: validation.error, retryable: false } });
      return;
    }
    credentialState.scopes = [...identityResult.payload.scopes];
    if (matched.upstreamPath === "/admin/v1/me") upstreamResult = identityResult;
  }
  if (!credentialState.scopes.includes(matched.requiredScope)) {
    sendJson(response, 403, { error: { code: "ADMIN_SCOPE_MISSING", message: `Credential is missing ${matched.requiredScope}`, retryable: false } });
    return;
  }
  upstreamResult ||= await callAdminUpstream({ path: matched.upstreamPath, method: request.method, query: safeQuery, body, upstreamBaseUrl, upstreamToken, fetchImpl, browserRequest: request });
  sendApiResult(response, matched, upstreamResult.status, upstreamResult.payload);
}

async function callAdminUpstream({ path, method, query, body, upstreamBaseUrl, upstreamToken, fetchImpl, browserRequest }) {
  const upstreamUrl = new URL(path, ensureTrailingSlash(upstreamBaseUrl));
  upstreamUrl.search = query.toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const requestBody = body && Object.keys(body).length ? JSON.stringify(body) : undefined;
  try {
    const upstream = await fetchImpl(upstreamUrl, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${upstreamToken}`,
        ...(browserRequest?.headers?.cookie ? { cookie: browserRequest.headers.cookie } : {}),
        ...(browserRequest?.headers?.origin ? { origin: browserRequest.headers.origin } : {}),
        ...(browserRequest?.headers?.referer ? { referer: browserRequest.headers.referer } : {}),
        ...(browserRequest?.headers?.["user-agent"] ? { "user-agent": browserRequest.headers["user-agent"] } : {}),
        ...(browserRequest?.headers?.["x-csrf-token"] ? { "x-csrf-token": browserRequest.headers["x-csrf-token"] } : {}),
        ...(browserRequest?.headers?.["x-request-id"] ? { "x-request-id": browserRequest.headers["x-request-id"] } : {}),
        ...(requestBody ? {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(requestBody))
        } : {})
      },
      body: requestBody,
      signal: controller.signal
    });
    const contentType = upstream.headers.get("content-type") || "";
    const payload = upstream.status === 204 ? null : contentType.includes("application/json") ? await upstream.json() : apiError("INVALID_UPSTREAM_RESPONSE", "The admin control plane returned an invalid response");
    return { status: upstream.status, payload, setCookies: readSetCookies(upstream.headers) };
  } catch (error) {
    return { status: error?.name === "AbortError" ? 504 : 502, payload: { error: { code: error?.name === "AbortError" ? "ADMIN_UPSTREAM_TIMEOUT" : "ADMIN_UPSTREAM_UNAVAILABLE", message: "The admin control plane is unavailable", retryable: true } } };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAdminAuthUpstream({ path, method, query, upstreamBaseUrl, fetchImpl, browserRequest }) {
  const upstreamUrl = new URL(path, ensureTrailingSlash(upstreamBaseUrl));
  upstreamUrl.search = query.toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const upstream = await fetchImpl(upstreamUrl, {
      method,
      headers: {
        accept: "application/json, text/html;q=0.9, */*;q=0.8",
        ...(browserRequest?.headers?.cookie ? { cookie: browserRequest.headers.cookie } : {}),
        ...(browserRequest?.headers?.origin ? { origin: browserRequest.headers.origin } : {}),
        ...(browserRequest?.headers?.referer ? { referer: browserRequest.headers.referer } : {}),
        ...(browserRequest?.headers?.["user-agent"] ? { "user-agent": browserRequest.headers["user-agent"] } : {}),
        ...(browserRequest?.headers?.["x-csrf-token"] ? { "x-csrf-token": browserRequest.headers["x-csrf-token"] } : {}),
        ...(browserRequest?.headers?.["x-request-id"] ? { "x-request-id": browserRequest.headers["x-request-id"] } : {})
      },
      redirect: "manual",
      signal: controller.signal
    });
    return {
      status: upstream.status,
      body: Buffer.from(await upstream.arrayBuffer()),
      contentType: upstream.headers.get("content-type") || "",
      location: upstream.headers.get("location") || "",
      setCookies: readSetCookies(upstream.headers)
    };
  } catch (error) {
    const timeoutError = error?.name === "AbortError";
    return {
      status: timeoutError ? 504 : 502,
      error: apiError(timeoutError ? "ADMIN_UPSTREAM_TIMEOUT" : "ADMIN_UPSTREAM_UNAVAILABLE", "The admin control plane is unavailable", true)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (values.length) return values;
  }
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("body_too_large");
      error.statusCode = 413;
      error.publicCode = "BODY_TOO_LARGE";
      error.publicMessage = "The request body is too large";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid_json");
    error.statusCode = 400;
    error.publicCode = "INVALID_JSON";
    error.publicMessage = "The request body is not valid JSON";
    throw error;
  }
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(staticRoot, safePath);
  try {
    const file = await readFile(filePath);
    setHeaders(response, { "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-store" });
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(file);
  } catch {
    filePath = join(staticRoot, "index.html");
    const file = await readFile(filePath);
    setHeaders(response, { "cache-control": "no-store" });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(file);
  }
}

function contentType(pathname) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".png": "image/png" })[extname(pathname)] || "application/octet-stream";
}

function ensureTrailingSlash(value) { return value.endsWith("/") ? value : `${value}/`; }
function safeRequestId(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
function logRequest({ request, response, requestId, startedAt }) {
  const pathname = new URL(request.url || "/", "http://console.local").pathname;
  const browserPath = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) || "/" : "";
  const matched = browserPath ? matchAdminRoute(request.method, browserPath) : null;
  const authDefinition = ADMIN_AUTH_ROUTE_DEFINITIONS.find((definition) => definition.path === pathname);
  const route = pathname === "/health/live" || pathname === "/health/ready"
    ? pathname
    : authDefinition
      ? authDefinition.path
      : pathname === ADMIN_AUTH_PREFIX || pathname.startsWith(`${ADMIN_AUTH_PREFIX}/`)
        ? `${ADMIN_AUTH_PREFIX}/denied`
        : browserPath === "/auth/csrf"
          ? `${API_PREFIX}/auth/csrf`
        : matched
          ? `${API_PREFIX}${matched.browserPattern}`
          : pathname.startsWith(API_PREFIX)
            ? `${API_PREFIX}/denied`
            : "/static";
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  process.stdout.write(`${JSON.stringify({
    level: response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
    time: new Date().toISOString(),
    service: "platform-admin-console",
    requestId,
    method: request.method || "GET",
    route,
    status: response.statusCode,
    durationMs: Number(durationMs.toFixed(2))
  })}\n`);
}
function setHeaders(response, headers) { for (const [name, value] of Object.entries(headers)) response.setHeader(name, value); }
function apiError(code, message, retryable = false) { return { error: { code, message, retryable } }; }
function sendApiResult(response, definition, status, payload) {
  if (status === 204) { response.writeHead(204); response.end(); return; }
  sendJson(response, status, status >= 200 && status < 300 ? projectAdminResponse(definition, payload) : payload);
}
function sendJson(response, status, body) { response.writeHead(status, { "content-type": "application/json; charset=utf-8" }); response.end(JSON.stringify(body)); }

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || "127.0.0.1";
  createAdminConsoleServer({ developmentMode: process.argv.includes("--dev") }).listen(port, host, () => {
    process.stdout.write(`AcornOps Platform Admin Console listening on http://${host}:${port}\n`);
  });
}
