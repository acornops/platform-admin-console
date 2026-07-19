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
const publicRoot = join(root, "public");
const FONT_FILES = new Map([
  ["/fonts/outfit-latin-400-normal.woff2", "node_modules/@fontsource/outfit/files/outfit-latin-400-normal.woff2"],
  ["/fonts/outfit-latin-500-normal.woff2", "node_modules/@fontsource/outfit/files/outfit-latin-500-normal.woff2"],
  ["/fonts/outfit-latin-600-normal.woff2", "node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2"],
  ["/fonts/outfit-latin-700-normal.woff2", "node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2"],
  ["/fonts/ubuntu-mono-latin-400-normal.woff2", "node_modules/@fontsource/ubuntu-mono/files/ubuntu-mono-latin-400-normal.woff2"],
  ["/fonts/ubuntu-mono-latin-700-normal.woff2", "node_modules/@fontsource/ubuntu-mono/files/ubuntu-mono-latin-700-normal.woff2"]
]);
const API_PREFIX = "/admin-console-api";
const MAX_BODY_BYTES = 32_768;
const SECURITY_HEADERS = Object.freeze({
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
});

export { ADMIN_ROUTE_DEFINITIONS, matchAdminRoute };

export function createAdminConsoleServer(options = {}) {
  const mode = options.mode || process.env.ADMIN_CONSOLE_DATA_MODE || "mock";
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

  return createServer(async (request, response) => {
    const startedAt = process.hrtime.bigint();
    const requestId = safeRequestId(request.headers["x-request-id"]);
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    response.once("finish", () => logRequest({ request, response, requestId, startedAt }));
    try {
      setHeaders(response, SECURITY_HEADERS);
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
      if (url.pathname.startsWith(API_PREFIX)) {
        await handleApi({ request, response, url, mode, upstreamBaseUrl, upstreamToken, mockStore, fetchImpl, credentialState, requireHumanIdentity });
        return;
      }
      if (!["GET", "HEAD"].includes(request.method || "GET")) {
        sendJson(response, 405, apiError("METHOD_NOT_ALLOWED", "Method not allowed"));
        return;
      }
      await serveStatic(response, url.pathname);
    } catch (error) {
      sendJson(response, error?.statusCode || 500, apiError(error?.publicCode || "REQUEST_FAILED", error?.publicMessage || "Request failed"));
    }
  });
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
    if (mode !== "control-plane" || !upstreamBaseUrl || !upstreamToken) {
      sendJson(response, 503, apiError("ADMIN_UPSTREAM_NOT_CONFIGURED", "The admin control plane is not configured"));
      return;
    }
    const result = await callAdminUpstream({ path: "/admin-auth/csrf", method: "GET", query: new URLSearchParams(), upstreamBaseUrl, upstreamToken, fetchImpl, browserRequest: request });
    if (result.setCookie) response.setHeader("set-cookie", result.setCookie);
    sendJson(response, result.status, result.payload);
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
        ...(body && Object.keys(body).length ? { "content-type": "application/json" } : {})
      },
      body: body && Object.keys(body).length ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const contentType = upstream.headers.get("content-type") || "";
    const payload = upstream.status === 204 ? null : contentType.includes("application/json") ? await upstream.json() : apiError("INVALID_UPSTREAM_RESPONSE", "The admin control plane returned an invalid response");
    return { status: upstream.status, payload, setCookie: upstream.headers.get("set-cookie") || undefined };
  } catch (error) {
    return { status: error?.name === "AbortError" ? 504 : 502, payload: { error: { code: error?.name === "AbortError" ? "ADMIN_UPSTREAM_TIMEOUT" : "ADMIN_UPSTREAM_UNAVAILABLE", message: "The admin control plane is unavailable", retryable: true } } };
  } finally {
    clearTimeout(timeout);
  }
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
  const fontFile = FONT_FILES.get(pathname);
  if (fontFile) {
    const file = await readFile(join(root, fontFile));
    setHeaders(response, { "cache-control": "public, max-age=31536000, immutable" });
    response.writeHead(200, { "content-type": "font/woff2" });
    response.end(file);
    return;
  }
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(publicRoot, safePath);
  try {
    const file = await readFile(filePath);
    setHeaders(response, { "cache-control": "no-store" });
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(file);
  } catch {
    filePath = join(publicRoot, "index.html");
    const file = await readFile(filePath);
    setHeaders(response, { "cache-control": "no-store" });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(file);
  }
}

function contentType(pathname) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" })[extname(pathname)] || "application/octet-stream";
}

function ensureTrailingSlash(value) { return value.endsWith("/") ? value : `${value}/`; }
function safeRequestId(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}
function logRequest({ request, response, requestId, startedAt }) {
  const pathname = new URL(request.url || "/", "http://console.local").pathname;
  const browserPath = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) || "/" : "";
  const matched = browserPath ? matchAdminRoute(request.method, browserPath) : null;
  const route = pathname === "/health/live" || pathname === "/health/ready"
    ? pathname
    : browserPath === "/auth/csrf"
      ? `${API_PREFIX}/auth/csrf`
      : matched
        ? `${API_PREFIX}${matched.browserPattern}`
        : pathname.startsWith(API_PREFIX)
          ? `${API_PREFIX}/denied`
          : pathname.startsWith("/fonts/")
            ? "/fonts/:asset"
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
  createAdminConsoleServer().listen(port, host, () => {
    process.stdout.write(`AcornOps Platform Admin Console listening on http://${host}:${port}\n`);
  });
}
