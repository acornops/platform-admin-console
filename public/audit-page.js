import { enhanceSelect } from "./menu-controls.js";

const AUDIT_ACTIONS = [
  ["admin.system.setting.read", "Viewed platform settings"],
  ["admin.system.setting.update", "Updated platform setting"],
  ["admin.system.setting.reset", "Reset platform setting"],
  ["admin.system.llm_provider_defaults.read", "Viewed default LLM key status"],
  ["admin.system.llm_provider_default.update", "Updated default LLM key"],
  ["admin.system.llm_provider_default.delete", "Deleted default LLM key"],
  ["admin.workspace.detail.read", "Viewed workspace details"],
  ["admin.workspace.plan.update", "Changed workspace plan"],
  ["admin.workspace.suspend", "Modified workspace status"],
  ["admin.workspace.restore", "Modified workspace status"],
  ["admin.workspace.member.add", "Modified workspace access"],
  ["admin.workspace.member.delete", "Modified workspace access"],
  ["admin.workspace.member.role.update", "Updated member role"],
  ["admin.member.role.update", "Updated member role"]
];

let auditItems = [], nextCursor = "", isLoadingMore = false, observer = null, requestSequence = 0, activeQuery = new URLSearchParams(), detailTrigger = null;

export function cleanupAuditPage() {
  observer?.disconnect(); observer = null; requestSequence += 1;
  document.querySelector("#audit-detail-layer")?.remove();
}

export async function renderAuditPage(context) {
  const { main, pageHeader } = context;
  main.innerHTML = `${pageHeader("Admin Audit", "A platform-level record of privileged governance actions. Workspace audit events are intentionally unavailable.", "", "audit-page-header")}
    <section class="ledger" id="admin-audit-ledger">
      ${auditFilterMarkup()}
      <div class="ledger-heading"><div><h2>Governance Events</h2><p id="audit-event-count">Loading events…</p></div><span class="tag">Privacy-filtered</span></div>
      <div class="audit-table" role="table" aria-label="Governance events">
        <div class="audit-columns" role="row"><span role="columnheader">Time</span><span role="columnheader">Event</span><span role="columnheader">Actor</span><span role="columnheader">Object</span><span role="columnheader" class="audit-details-heading">Details</span></div>
        <div id="audit-events" role="rowgroup"></div>
      </div>
      <div id="audit-pagination-slot"></div>
    </section>
    ${auditDetailLayerMarkup()}`;
  bindAuditFilters(context);
  bindAuditDetails(main);
  await loadAuditEvents(context);
}

function auditFilterMarkup() {
  return `<form class="audit-filters" id="audit-filters">
    <div class="audit-filter-grid">
      <label><span class="visually-hidden">Filter by event</span><select id="audit-filter-action" aria-label="Filter by event"><option value="">All events</option>${auditFilterOptions().map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
      <label class="audit-filter-input"><span class="visually-hidden">Filter by workspace</span><input class="input" id="audit-filter-workspace" placeholder="Workspace ID" autocomplete="off"></label>
      <label class="audit-filter-input"><span class="visually-hidden">Filter by admin actor</span><input class="input" id="audit-filter-actor" placeholder="Admin actor" autocomplete="off"></label>
      <label><span class="visually-hidden">Filter by outcome</span><select id="audit-filter-outcome" aria-label="Filter by outcome"><option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option></select></label>
    </div>
    <div class="audit-time-toolbar">
      <fieldset><legend class="visually-hidden">Time period</legend><div class="audit-time-presets"><button type="button" data-audit-preset="today">Today</button><button type="button" data-audit-preset="24h">Last 24h</button><button type="button" data-audit-preset="7d">Past 7d</button><button type="button" data-audit-preset="30d">Past 30d</button><button type="button" id="audit-custom-toggle" aria-expanded="false" aria-controls="audit-custom-range">Custom range</button></div></fieldset>
      <div class="audit-filter-actions"><button class="button secondary" id="audit-clear-filters" type="button">Clear</button><button class="button primary" type="submit">Apply filters</button></div>
    </div>
    <div class="audit-custom-range" id="audit-custom-range" hidden><label>From<input class="input" id="audit-filter-from" type="datetime-local"></label><label>To<input class="input" id="audit-filter-to" type="datetime-local"></label></div>
  </form>`;
}

function bindAuditFilters(context) {
  enhanceSelect(context.main.querySelector("#audit-filter-action"), { compact: true });
  enhanceSelect(context.main.querySelector("#audit-filter-outcome"), { compact: true });
  const form = context.main.querySelector("#audit-filters"), custom = form.querySelector("#audit-custom-range"), customToggle = form.querySelector("#audit-custom-toggle");
  form.addEventListener("submit", (event) => { event.preventDefault(); void applyFilters(context); });
  form.querySelector("#audit-clear-filters").addEventListener("click", () => {
    form.reset(); form.querySelectorAll("select").forEach((select) => select.dispatchEvent(new Event("change", { bubbles: true })));
    form.querySelectorAll("[data-audit-preset]").forEach((button) => button.classList.remove("active"));
    custom.hidden = true; customToggle.setAttribute("aria-expanded", "false"); activeQuery = new URLSearchParams(); void loadAuditEvents(context);
  });
  customToggle.addEventListener("click", () => { custom.hidden = !custom.hidden; customToggle.setAttribute("aria-expanded", String(!custom.hidden)); });
  form.querySelectorAll("[data-audit-preset]").forEach((button) => button.addEventListener("click", () => {
    form.querySelectorAll("[data-audit-preset]").forEach((item) => item.classList.toggle("active", item === button));
    const { now, from } = auditPresetRange(button.dataset.auditPreset);
    form.querySelector("#audit-filter-from").value = localDateTime(from); form.querySelector("#audit-filter-to").value = localDateTime(now);
    custom.hidden = true; customToggle.setAttribute("aria-expanded", "false"); void applyFilters(context);
  }));
}

function applyFilters(context) {
  const form = context.main.querySelector("#audit-filters");
  const selectedAction = form.querySelector("#audit-filter-action").value;
  const values = { [selectedAction.startsWith("group:") ? "actionGroup" : "action"]: selectedAction.replace(/^group:/, ""), workspaceId: form.querySelector("#audit-filter-workspace").value.trim(), adminActorSubject: form.querySelector("#audit-filter-actor").value.trim(), outcome: form.querySelector("#audit-filter-outcome").value };
  const from = form.querySelector("#audit-filter-from").value, to = form.querySelector("#audit-filter-to").value;
  activeQuery = buildAuditQuery(values, from, to);
  return loadAuditEvents(context);
}

export function buildAuditQuery(values, from = "", to = "") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values || {})) if (String(value || "").trim()) query.set(key, String(value).trim());
  if (from) query.set("from", new Date(from).toISOString());
  if (to) query.set("to", new Date(to).toISOString());
  return query;
}

export function auditPresetRange(preset, currentTime = new Date()) {
  const now = new Date(currentTime), from = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  else if (preset === "24h") from.setHours(from.getHours() - 24);
  else if (preset === "7d" || preset === "30d") from.setDate(from.getDate() - Number.parseInt(preset, 10));
  else throw new Error("Unsupported audit time preset");
  return { now, from };
}

async function loadAuditEvents(context, { append = false } = {}) {
  const requestId = ++requestSequence, params = new URLSearchParams(activeQuery); params.set("limit", "50");
  if (append && nextCursor) params.set("cursor", nextCursor);
  if (!append) { observer?.disconnect(); context.main.querySelector("#audit-events").innerHTML = '<div class="audit-loading" role="status">Loading governance events…</div>'; }
  const response = await context.api(`/admin-audit-events?${params}`);
  if (requestId !== requestSequence) return;
  auditItems = append ? [...auditItems, ...response.items] : response.items;
  nextCursor = response.nextCursor || ""; isLoadingMore = false;
  context.main.querySelector("#audit-events").innerHTML = auditItems.map((event, index) => auditEventMarkup(event, index)).join("") || '<div class="empty-state"><strong>No matching admin activity</strong>Adjust the filters or time period.</div>';
  context.main.querySelector("#audit-event-count").textContent = auditEventCount(auditItems.length);
  context.main.querySelector("#audit-pagination-slot").innerHTML = auditPaginationMarkup(nextCursor);
  bindAuditRows(context.main); bindAuditPagination(context);
}

function auditEventMarkup(event, index) { return `<article class="audit-event" role="row"><div role="cell"><span class="audit-cell-label">Time</span><time datetime="${escapeText(event.occurredAt)}">${escapeText(formatDateTime(event.occurredAt))}</time></div><div role="cell"><span class="audit-cell-label">Event</span><div class="audit-action">${escapeText(labelAuditEvent(event.action))}</div><div class="audit-reason mono">${escapeText(event.action)} · ${escapeText(titleCase(event.outcome || "unknown"))}</div></div><div role="cell"><span class="audit-cell-label">Actor</span><strong>${escapeText(auditActorName(event))}</strong></div><div role="cell"><span class="audit-cell-label">Object</span>${auditAffectedMarkup(event)}</div><div role="cell" class="audit-details-cell"><span class="audit-cell-label">Details</span><button class="audit-details-button tooltip-button" type="button" data-audit-details="${index}" data-tooltip="View details" aria-label="View details for ${escapeText(labelAuditEvent(event.action))}">${eyeIcon()}</button></div></article>`; }
function auditEventCount(count) { return `${count} ${count === 1 ? "event" : "events"} logged`; }
function auditPaginationMarkup(cursor) { return cursor ? '<div class="audit-pagination" id="audit-pagination"><div id="audit-load-more-trigger" aria-hidden="true"></div><button class="button secondary" id="audit-load-more" type="button">Load more</button><p class="audit-pagination-error" id="audit-pagination-error" role="alert" hidden></p></div>' : ""; }

function bindAuditRows(main) { main.querySelectorAll("[data-audit-details]").forEach((button) => button.addEventListener("click", () => openAuditDetails(Number(button.dataset.auditDetails), button))); }
function bindAuditDetails(main) {
  const layer = main.querySelector("#audit-detail-layer");
  layer.addEventListener("mousedown", (event) => { if (event.target === layer) closeAuditDetails(); });
  layer.querySelector("#audit-detail-close").addEventListener("click", closeAuditDetails);
  layer.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAuditDetails(); });
}
function openAuditDetails(index, trigger) {
  const event = auditItems[index], layer = document.querySelector("#audit-detail-layer"); if (!event) return;
  detailTrigger = trigger; layer.querySelector("#audit-detail-title").textContent = labelAuditEvent(event.action); layer.querySelector("#audit-detail-subtitle").textContent = "Governance";
  layer.querySelector("#audit-detail-content").innerHTML = auditDetailContent(event);
  layer.querySelector("#audit-copy-raw").addEventListener("click", async (clickEvent) => {
    const button = clickEvent.currentTarget;
    const copied = await copyText(rawAuditKeyValues(event));
    if (!copied) selectRawRecord(layer.querySelector(".audit-raw-values code"));
    button.setAttribute("aria-label", copied ? "Event data copied" : "Event data selected — press Command C or Control C");
    button.dataset.tooltip = copied ? "Copied" : "Selected — press ⌘C / Ctrl+C";
    setTimeout(() => { if (button.isConnected) { button.setAttribute("aria-label", "Copy event data"); button.dataset.tooltip = "Copy event data"; } }, 1800);
  });
  layer.hidden = false; requestAnimationFrame(() => { layer.classList.add("open"); layer.querySelector("#audit-detail-close").focus(); });
}
function closeAuditDetails() { const layer = document.querySelector("#audit-detail-layer"); if (!layer || layer.hidden) return; layer.classList.remove("open"); setTimeout(() => { layer.hidden = true; detailTrigger?.focus(); detailTrigger = null; }, 180); }
function auditDetailLayerMarkup() { return `<div class="user-panel-layer audit-detail-layer" id="audit-detail-layer" hidden><aside class="user-panel audit-detail-panel" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" tabindex="-1"><header class="audit-reference-header"><div><p id="audit-detail-subtitle">Governance</p><h2 id="audit-detail-title">Audit event</h2></div><button class="panel-close audit-reference-close" id="audit-detail-close" type="button" aria-label="Close audit details">${closeIcon()}</button></header><div class="user-panel-content audit-reference-content" id="audit-detail-content"></div></aside></div>`; }
function auditDetailContent(event) {
  const correlationId = event.metadata?.correlationId || "Not applicable";
  const rows = [["Time", formatDateTimeLong(event.occurredAt)], ["Event type", event.action], ["Outcome", titleCase(event.outcome || "unknown")], ["Actor", auditActorName(event)], ["Object", auditAffectedText(event)], ["Correlation ID", correlationId]];
  return `<dl class="audit-detail-grid">${rows.map(([label, value]) => `<div><dt>${escapeText(label)}</dt><dd>${escapeText(value)}</dd></div>`).join("")}</dl><section class="audit-raw-section"><h3 class="visually-hidden">Event data</h3><div class="audit-data-block"><button class="audit-copy-raw tooltip-button" id="audit-copy-raw" type="button" data-tooltip="Copy event data" aria-label="Copy event data">${copyIcon()}</button><pre class="audit-raw-values"><code>${escapeText(rawAuditKeyValues(event))}</code></pre></div></section>`;
}

export function rawAuditKeyValues(event) {
  const entries = [];
  for (const [key, value] of Object.entries(event || {})) {
    if (key === "metadata" || value === undefined || value === null) continue;
    entries.push([key, typeof value === "object" ? JSON.stringify(value) : value]);
  }
  for (const [key, value] of Object.entries(event?.metadata || {})) {
    if (key === "ticket" + "Ref" || value === undefined || value === null) continue;
    entries.push([key, typeof value === "object" ? JSON.stringify(value) : value]);
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join("\n") || "No event data";
}

export function auditActorName(event = {}) { return event.adminActorDisplayName || event.adminActorEmail || event.adminActorSubject || "Unknown administrator"; }

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await Promise.race([navigator.clipboard.writeText(value), new Promise((_, reject) => setTimeout(() => reject(new Error("Clipboard timed out")), 300))]);
      return true;
    } catch { /* Use the browser-compatible selection fallback below. */ }
  }
  const field = document.createElement("textarea"); field.value = value; field.setAttribute("readonly", ""); field.style.position = "fixed"; field.style.opacity = "0"; document.body.append(field); field.select();
  const copied = document.execCommand("copy"); field.remove(); return copied;
}

function selectRawRecord(element) {
  const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents(element); selection.removeAllRanges(); selection.addRange(range);
}

function bindAuditPagination(context) {
  observer?.disconnect(); observer = null;
  const button = context.main.querySelector("#audit-load-more"), trigger = context.main.querySelector("#audit-load-more-trigger"); if (!button || !trigger || !nextCursor) return;
  button.addEventListener("click", () => loadMoreAuditEvents(context));
  if (typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver((entries) => { if (!entries.some((entry) => entry.isIntersecting) || isLoadingMore || !nextCursor) return; observer?.disconnect(); loadMoreAuditEvents(context); }, { root: context.main, rootMargin: "240px 0px" }); observer.observe(trigger);
}
async function loadMoreAuditEvents(context) {
  if (!nextCursor || isLoadingMore) return; isLoadingMore = true; const button = context.main.querySelector("#audit-load-more"), error = context.main.querySelector("#audit-pagination-error");
  if (button) { button.disabled = true; button.textContent = "Loading more…"; } if (error) error.hidden = true;
  try { await loadAuditEvents(context, { append: true }); } catch (loadError) { isLoadingMore = false; if (error) { error.hidden = false; error.textContent = `Unable to load more events. ${context.readableError(loadError)}`; } if (button) { button.disabled = false; button.textContent = "Load more"; } }
}

function labelAuditEvent(value) { return new Map(AUDIT_ACTIONS.map(([action, label]) => [action, label])).get(value) || String(value).split(".").map(titleCase).join(" · "); }
function auditFilterOptions() { return [
  ["admin.workspace.detail.read", "Viewed workspace details"],
  ["admin.workspace.plan.update", "Changed workspace plan"],
  ["group:workspace_status_modified", "Modified workspace status"],
  ["group:workspace_access_modified", "Modified workspace access"]
]; }
export function auditAffectedMarkup(event) { if (event.workspaceId) return `<div class="audit-affected-primary"><span>Workspace</span><strong>${escapeText(event.workspaceName || event.workspaceId)}</strong></div>${event.subjectId ? `<div class="audit-context"><span>${escapeText(titleCase(event.subjectType || "Item"))}</span><span class="mono">${escapeText(event.subjectId)}</span></div>` : ""}`; if (event.subjectId) return `<div class="audit-affected-primary"><span>${escapeText(titleCase(event.subjectType || "Item"))}</span><strong class="mono">${escapeText(event.subjectId)}</strong></div>`; return '<div class="audit-affected-primary"><strong>Platform</strong></div>'; }
export function auditAffectedText(event) { return [event.workspaceId ? `Workspace ${event.workspaceName || event.workspaceId}` : "", event.subjectId ? `${titleCase(event.subjectType || "Item")} ${event.subjectId}` : ""].filter(Boolean).join(" · ") || "Platform"; }
function localDateTime(date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }
function titleCase(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatDateTimeLong(value) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)); }
function eyeIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'; }
function copyIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'; }
function closeIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'; }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
