import { enhanceCombobox, enhanceSelect } from "./menu-controls.js";

const USER_PAGE_LIMIT = 25;
const FILTER_PAGE_LIMIT = 100;

export async function renderUserDirectory({ main, selectedUserId, api, state, pageHeader, userRows, emptyTable, openUserPanel, showToast, readableError }) {
  const [response, workspaces] = await Promise.all([api(`/users?limit=${USER_PAGE_LIMIT}`), loadAllWorkspaces(api)]);
  state.users = response.items;
  state.workspaces = workspaces;
  let nextCursor = response.nextCursor;
  main.innerHTML = `
    ${pageHeader("Users", "Review identity and workspace access for AcornOps users.")}
    <section class="ledger" id="user-directory">
      <div class="directory-toolbar">
        <div class="directory-search">
          <label class="visually-hidden" for="user-search">Search users</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input class="input" id="user-search" type="search" placeholder="Search name, email, or ID" autocomplete="off">
        </div>
        <div class="workspace-filter-control">
          <label class="visually-hidden" for="user-workspace-filter">Filter users by workspace</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          <input class="input" id="user-workspace-filter" type="search" placeholder="Filter by workspace" autocomplete="off">
        </div>
        <label class="visually-hidden" for="user-verification">Filter users by verification</label>
        <select class="directory-filter" id="user-verification" aria-label="Filter users by verification"><option value="all">All users</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select>
        <span class="result-count" id="user-count" aria-live="polite"></span>
      </div>
      <div class="table-wrap" id="user-table-wrap"><table aria-label="Users"><thead><tr><th>User</th><th>Email</th><th>Verified</th><th>Auth methods</th><th>Workspaces</th><th>Created</th></tr></thead><tbody id="user-rows"></tbody></table></div>
      <div class="pagination-footer" id="user-pagination" hidden><button class="button secondary" id="user-load-more" type="button">Load more</button></div>
    </section>`;

  const search = document.querySelector("#user-search"), workspaceFilter = document.querySelector("#user-workspace-filter"), verification = document.querySelector("#user-verification");
  const rows = document.querySelector("#user-rows"), count = document.querySelector("#user-count"), pagination = document.querySelector("#user-pagination");
  const loadMore = document.querySelector("#user-load-more"), tableWrap = document.querySelector("#user-table-wrap");
  workspaceFilter.value = new URLSearchParams(location.search).get("workspace") || "";
  enhanceCombobox(workspaceFilter, workspaces);
  enhanceSelect(verification);
  let requestSequence = 0;
  let reloadTimer;

  const updateDirectory = () => {
    const visibleUsers = filterUsersByWorkspace(state.users, state.workspaces, state.workspaceAccessByUser, workspaceFilter.value);
    rows.innerHTML = userRows(visibleUsers, state.userPanelId) || emptyTable("No users match this search or filter.", 6);
    count.textContent = `Showing ${visibleUsers.length} of ${state.users.length}${nextCursor ? " loaded" : ""}`;
    pagination.hidden = !nextCursor || Boolean(workspaceFilter.value.trim());
  };
  state.refreshUserDirectory = updateDirectory;

  const indexWorkspaceAccess = async (users) => {
    const missing = users.filter((user) => !state.workspaceAccessByUser.has(user.id));
    await Promise.all(missing.map(async (user) => {
      const detail = await api(`/users/${encodeURIComponent(user.id)}`);
      state.workspaceAccessByUser.set(user.id, new Set(detail.memberships.map((membership) => membership.workspaceId)));
      user.workspaceMembershipCount = detail.memberships.length;
    }));
  };

  const loadUsers = async ({ append = false } = {}) => {
    if (append && (!nextCursor || workspaceFilter.value.trim())) return;
    const requestId = ++requestSequence;
    const workspaceQuery = workspaceFilter.value.trim();
    const params = new URLSearchParams({ limit: String(workspaceQuery ? FILTER_PAGE_LIMIT : USER_PAGE_LIMIT) });
    const query = search.value.trim();
    if (query) params.set("q", query);
    if (verification.value !== "all") params.set("emailVerified", String(verification.value === "verified"));
    if (append) params.set("cursor", nextCursor);
    loadMore.disabled = true;
    loadMore.textContent = append ? "Loading…" : "Load more";
    tableWrap.setAttribute("aria-busy", "true");
    if (workspaceQuery) count.textContent = "Filtering workspace access…";
    try {
      let page = await api(`/users?${params}`);
      const items = [...page.items];
      while (workspaceQuery && page.nextCursor) {
        params.set("cursor", page.nextCursor);
        page = await api(`/users?${params}`);
        items.push(...page.items);
      }
      if (requestId !== requestSequence) return;
      if (append) {
        const knownIds = new Set(state.users.map((user) => user.id));
        state.users.push(...items.filter((user) => !knownIds.has(user.id)));
      } else state.users = items;
      if (workspaceQuery) await indexWorkspaceAccess(state.users);
      if (requestId !== requestSequence) return;
      nextCursor = workspaceQuery ? undefined : page.nextCursor;
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
    reloadTimer = setTimeout(() => loadUsers(), 240);
  };
  search.addEventListener("input", scheduleReload);
  workspaceFilter.addEventListener("input", scheduleReload);
  verification.addEventListener("change", () => loadUsers());
  loadMore.addEventListener("click", () => loadUsers({ append: true }));
  updateDirectory();
  if (workspaceFilter.value) await loadUsers();
  if (selectedUserId) await openUserPanel(selectedUserId, { updateHistory: false });
}

export function filterUsersByWorkspace(users, workspaces, accessByUser, value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) return users;
  const matchingIds = new Set(workspaces.filter((workspace) => [workspace.name, workspace.id].some((field) => String(field || "").toLowerCase().includes(query))).map((workspace) => workspace.id));
  return users.filter((user) => [...(accessByUser.get(user.id) || [])].some((workspaceId) => matchingIds.has(workspaceId)));
}

async function loadAllWorkspaces(api) {
  const params = new URLSearchParams({ limit: String(FILTER_PAGE_LIMIT) });
  let page = await api(`/workspaces?${params}`);
  const workspaces = [...page.items];
  while (page.nextCursor) {
    params.set("cursor", page.nextCursor);
    page = await api(`/workspaces?${params}`);
    workspaces.push(...page.items);
  }
  return workspaces;
}

function escapeAttr(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
