import { enhanceSelect } from "./menu-controls.js";

const WORKSPACE_PAGE_LIMIT = 25;
const FILTER_PAGE_LIMIT = 100;

export async function renderWorkspaceDirectory({ main, selectedWorkspaceId, api, state, pageHeader, emptyTable, openWorkspacePanel, showToast, readableError }) {
  const response = await api(`/workspaces?limit=${WORKSPACE_PAGE_LIMIT}`);
  state.workspaces = response.items;
  let nextCursor = response.nextCursor;

  main.innerHTML = `
    ${pageHeader("Workspaces", "Review workspace governance, plans, access, and creation details.")}
    <section class="ledger" id="workspace-directory">
      <div class="directory-toolbar workspace-directory-toolbar">
        <div class="directory-search">
          <label class="visually-hidden" for="workspace-search">Search workspaces by name</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input class="input" id="workspace-search" type="search" placeholder="Search workspace name" autocomplete="off">
        </div>
        <label class="visually-hidden" for="workspace-status">Filter workspaces by status</label>
        <select class="directory-filter" id="workspace-status" aria-label="Filter workspaces by status"><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
        <span class="result-count" id="workspace-count" aria-live="polite"></span>
      </div>
      <div class="table-wrap" id="workspace-table-wrap"><table aria-label="Workspaces"><thead><tr><th>Workspace</th><th>Created by</th><th>Members</th><th>Status</th><th>Created</th></tr></thead><tbody id="workspace-rows"></tbody></table></div>
      <div class="pagination-footer" id="workspace-pagination" hidden><button class="button secondary" id="workspace-load-more" type="button">Load more</button></div>
    </section>`;

  const search = document.querySelector("#workspace-search"), status = document.querySelector("#workspace-status");
  const rows = document.querySelector("#workspace-rows"), count = document.querySelector("#workspace-count"), pagination = document.querySelector("#workspace-pagination");
  const loadMore = document.querySelector("#workspace-load-more"), tableWrap = document.querySelector("#workspace-table-wrap");
  let requestSequence = 0;
  let reloadTimer;
  enhanceSelect(status);

  const updateDirectory = () => {
    rows.innerHTML = workspaceRows(state.workspaces, state.workspacePanelId) || emptyTable("No workspaces match this search or filter.", 5);
    count.textContent = `Showing ${state.workspaces.length} of ${state.workspaces.length}${nextCursor ? " loaded" : ""}`;
    pagination.hidden = !nextCursor;
  };

  const loadWorkspaces = async ({ append = false } = {}) => {
    if (append && !nextCursor) return;
    const requestId = ++requestSequence;
    const statusFilter = status.value;
    const params = new URLSearchParams({ limit: String(statusFilter === "all" ? WORKSPACE_PAGE_LIMIT : FILTER_PAGE_LIMIT) });
    const query = search.value.trim();
    if (query) params.set("q", query);
    if (append) params.set("cursor", nextCursor);
    loadMore.disabled = true;
    loadMore.textContent = append ? "Loading…" : "Load more";
    tableWrap.setAttribute("aria-busy", "true");
    try {
      let page = await api(`/workspaces?${params}`);
      const items = [...page.items];
      while (statusFilter !== "all" && page.nextCursor) {
        params.set("cursor", page.nextCursor);
        page = await api(`/workspaces?${params}`);
        items.push(...page.items);
      }
      if (requestId !== requestSequence) return;
      if (append) {
        const knownIds = new Set(state.workspaces.map((workspace) => workspace.id));
        state.workspaces.push(...items.filter((workspace) => !knownIds.has(workspace.id)));
      } else state.workspaces = items.filter((workspace) => statusFilter === "all" || workspace.lifecycleStatus === statusFilter);
      nextCursor = statusFilter === "all" ? page.nextCursor : undefined;
      updateDirectory();
    } catch (error) {
      if (requestId === requestSequence) showToast(readableError(error), "danger");
    } finally {
      if (requestId === requestSequence) {
        tableWrap.setAttribute("aria-busy", "false");
        loadMore.disabled = false;
        loadMore.textContent = "Load more";
      }
    }
  };

  const scheduleReload = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => loadWorkspaces(), 240);
  };
  search.addEventListener("input", scheduleReload);
  status.addEventListener("change", () => loadWorkspaces());
  loadMore.addEventListener("click", () => loadWorkspaces({ append: true }));
  updateDirectory();
  if (selectedWorkspaceId) await openWorkspacePanel(selectedWorkspaceId, { updateHistory: false });
}

export function workspaceRows(items, selectedWorkspaceId = null) {
  return items.map((workspace) => {
    const suspended = workspace.lifecycleStatus === "suspended";
    return `<tr data-workspace-id="${escapeAttr(workspace.id)}" tabindex="0" aria-selected="${String(workspace.id === selectedWorkspaceId)}"><td><span class="primary-cell">${escapeText(workspace.name)}</span><span class="secondary-cell">${escapeText(workspace.id)}</span></td><td><span class="mono">${escapeText(workspace.createdBy)}</span></td><td data-workspace-member-count>${Number(workspace.memberCount).toLocaleString()}</td><td><span class="status workspace-directory-status ${suspended ? "suspended" : "active"}">${suspended ? "Suspended" : "Active"}</span></td><td>${escapeText(formatDate(workspace.createdAt))}</td></tr>`;
  }).join("");
}

function formatDate(value) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function escapeAttr(value) { return escapeText(value); }
