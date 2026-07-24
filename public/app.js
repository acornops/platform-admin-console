import { trapFocus, userPanelMarkup } from "./user-panel-view.js";
import { createToastController } from "./toast.js";
import { bindMembershipEditors } from "./user-membership-actions.js";
import { renderUserDirectory } from "./user-directory.js";
import { renderWorkspaceDirectory } from "./workspace-directory.js";
import { loadAllUsers, loadWorkspaceMembers } from "./workspace-member-index.js";
import { workspaceMemberErrorMarkup, workspaceMemberTableMarkup, workspacePanelMarkup } from "./workspace-panel-view.js";
import { bindWorkspaceAccessManager } from "./workspace-access-actions.js";
import { cleanupMenuControls, enhanceSelect } from "./menu-controls.js";
import { overviewMarkup } from "./overview-view.js";
import { cleanupAuditPage, renderAuditPage } from "./audit-page.js";
import { bindAdminAccountMenu } from "./account-menu.js";

const main = document.querySelector("#main");
const dialog = document.querySelector("#action-dialog");
const dialogForm = document.querySelector("#dialog-form");
const dialogCancel = document.querySelector("#dialog-cancel");
const showToast = createToastController(document.querySelector("#toast"));
const sidebar = document.querySelector("#sidebar"), scrim = document.querySelector("#scrim"), menuButton = document.querySelector("#menu-button");
const userPanelLayer = document.querySelector("#user-panel-layer"), userPanel = document.querySelector("#user-panel"), userPanelContent = document.querySelector("#user-panel-content"), userPanelClose = document.querySelector("#user-panel-close");
const workspacePanelLayer = document.querySelector("#workspace-panel-layer"), workspacePanel = document.querySelector("#workspace-panel"), workspacePanelContent = document.querySelector("#workspace-panel-content"), workspacePanelClose = document.querySelector("#workspace-panel-close");
const appShell = document.querySelector(".app-shell");
const state = { identity: null, csrfToken: "", workspaces: [], users: [], systemConfig: null, workspaceAccessByUser: new Map(), refreshUserDirectory: null, dialogAction: null, userPanelId: null, userPanelRequest: 0, userPanelTrigger: null, workspacePanelId: null, workspacePanelRequest: 0, workspacePanelTrigger: null };
const adminAccountMenu = bindAdminAccountMenu({ onLogout: logout, onError: (message) => showToast(message, "danger") });
const routes = [
  { test: /^\/$/, name: "overview", render: renderOverview },
  { test: /^\/workspaces$/, name: "workspaces", render: () => renderWorkspaces() },
  { test: /^\/workspaces\/([^/]+)$/, name: "workspaces", render: (match) => renderWorkspaces(match[1]) },
  { test: /^\/users$/, name: "users", render: () => renderUsers() },
  { test: /^\/users\/([^/]+)$/, name: "users", render: (match) => renderUsers(match[1]) },
  { test: /^\/audit$/, name: "audit", render: () => renderAuditPage({ main, api, pageHeader, readableError }) }
];
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='/']");
  if (link && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    if (!workspacePanelLayer.hidden) closeWorkspacePanel({ updateHistory: false });
    if (!userPanelLayer.hidden) closeUserPanel({ updateHistory: false });
    navigate(link.getAttribute("href"));
    return;
  }
  const userRow = event.target.closest("[data-user-id]");
  if (userRow) {
    openUserPanel(userRow.dataset.userId, { updateHistory: true, trigger: userRow });
    return;
  }
  const workspaceRow = event.target.closest("[data-workspace-id]");
  if (workspaceRow) {
    openWorkspacePanel(workspaceRow.dataset.workspaceId, { updateHistory: true, trigger: workspaceRow });
    return;
  }
  const row = event.target.closest("[data-href]");
  if (row) navigate(row.dataset.href);
});
window.addEventListener("popstate", () => {
  const workspaceRoute = /^\/workspaces(?:\/([^/]+))?$/.exec(location.pathname);
  if (workspaceRoute && document.querySelector("#workspace-directory")) {
    if (workspaceRoute[1]) openWorkspacePanel(workspaceRoute[1], { updateHistory: false });
    else closeWorkspacePanel({ updateHistory: false });
    return;
  }
  const userRoute = /^\/users(?:\/([^/]+))?$/.exec(location.pathname);
  if (userRoute && document.querySelector("#user-directory")) {
    if (userRoute[1]) openUserPanel(userRoute[1], { updateHistory: false });
    else closeUserPanel({ updateHistory: false });
    return;
  }
  router();
});
menuButton.addEventListener("click", () => toggleMenu(!sidebar.classList.contains("open")));
scrim.addEventListener("click", () => toggleMenu(false));
dialogForm.addEventListener("submit", handleDialogSubmit);
dialogCancel.addEventListener("click", () => dialog.close("cancel"));
dialog.addEventListener("close", () => { state.dialogAction = null; });
userPanelClose.addEventListener("click", requestCloseUserPanel);
userPanelLayer.addEventListener("mousedown", (event) => {
  if (event.target === userPanelLayer) requestCloseUserPanel();
});
workspacePanelClose.addEventListener("click", requestCloseWorkspacePanel);
workspacePanelLayer.addEventListener("mousedown", (event) => {
  if (event.target === workspacePanelLayer) requestCloseWorkspacePanel();
});
await loadIdentity();
await router();

async function router() {
  toggleMenu(false);
  cleanupMenuControls(main);
  cleanupAuditPage();
  const route = routes.find((candidate) => candidate.test.test(location.pathname)) || routes[0];
  const match = route.test.exec(location.pathname);
  document.querySelectorAll("[data-route]").forEach((item) => item.toggleAttribute("aria-current", item.dataset.route === route.name));
  main.innerHTML = '<div class="loading">Opening governance ledger…</div>';
  try {
    await route.render(match);
    if (userPanelLayer.hidden && workspacePanelLayer.hidden) main.focus({ preventScroll: true });
  } catch (error) {
    main.innerHTML = errorView(error);
    document.querySelector("#retry")?.addEventListener("click", router);
  }
}

function navigate(path) {
  if (location.pathname !== path) history.pushState({}, "", path);
  router();
}

async function loadIdentity() {
  try {
    const admin = await api("/me");
    state.identity = admin.actor;
    const role = admin.actor?.roles?.[0] || "";
    document.body.dataset.adminRole = role;
    adminAccountMenu.setIdentity(admin.actor);
    document.querySelector('[data-route="audit"]').hidden = role === "platform-admin-viewer";
    document.querySelector('[data-route="overview"]').hidden = role === "platform-admin-auditor";
    document.querySelector('[data-route="workspaces"]').hidden = role === "platform-admin-auditor";
    document.querySelector('[data-route="users"]').hidden = role === "platform-admin-auditor";
    if (role === "platform-admin-auditor" && location.pathname !== "/audit") history.replaceState({}, "", "/audit");
  } catch (error) {
    if (error.status === 401) { location.assign(`/admin-auth/oidc/login?return_to=${encodeURIComponent(location.pathname)}`); await new Promise(() => {}); }
    throw error;
  }
}

async function renderOverview() {
  const [workspaces, users] = await Promise.all([loadAllAdminPages("/workspaces"), loadAllAdminPages("/users")]);
  state.workspaces = workspaces;
  state.users = users;
  main.innerHTML = overviewMarkup({ workspaces, users, pageHeader });
}

async function loadAllAdminPages(path) {
  const items = [];
  let cursor = "";
  do {
    const separator = path.includes("?") ? "&" : "?";
    const page = await api(`${path}${cursor ? `${separator}cursor=${encodeURIComponent(cursor)}` : ""}`);
    items.push(...page.items);
    cursor = page.nextCursor || "";
  } while (cursor);
  return items;
}

async function renderWorkspaces(selectedWorkspaceId) {
  await renderWorkspaceDirectory({ main, selectedWorkspaceId, api, state, pageHeader, emptyTable, openWorkspacePanel, showToast, readableError });
}

async function openWorkspacePanel(workspaceId, { updateHistory = false, trigger = null } = {}) {
  if (updateHistory && location.pathname !== `/workspaces/${workspaceId}`) history.pushState({ workspacePanel: true }, "", `/workspaces/${workspaceId}`);
  if (trigger) state.workspacePanelTrigger = trigger;
  state.workspacePanelId = workspaceId;
  const requestId = ++state.workspacePanelRequest;
  document.querySelectorAll("[data-workspace-id]").forEach((row) => row.setAttribute("aria-selected", String(row.dataset.workspaceId === workspaceId)));
  workspacePanelLayer.hidden = false;
  appShell.inert = true;
  appShell.setAttribute("aria-hidden", "true");
  workspacePanelContent.innerHTML = '<div class="panel-loading" role="status">Loading workspace details…</div>';
  document.querySelector("#workspace-panel-title").textContent = "Workspace Details";
  document.querySelector("#workspace-panel-id").textContent = "Loading workspace…";
  requestAnimationFrame(() => workspacePanelLayer.classList.add("open"));
  workspacePanelClose.focus({ preventScroll: true });

  try {
    const [workspace, config] = await Promise.all([
      api(`/workspaces/${encodeURIComponent(workspaceId)}`),
      loadSystemConfig()
    ]);
    if (requestId !== state.workspacePanelRequest) return;
    document.querySelector("#workspace-panel-title").textContent = workspace.name;
    document.querySelector("#workspace-panel-id").textContent = workspace.id;
    workspacePanelContent.innerHTML = workspacePanelMarkup(workspace, config.planCatalog?.plans || []);
    if (canMutate()) {
      workspacePanelContent.querySelector("[data-change-plan]").addEventListener("click", () => changePlan(workspace, config));
      workspacePanelContent.querySelector("[data-workspace-lifecycle]").addEventListener("click", () => changeWorkspaceLifecycle(workspace));
    } else {
      hideMutationControls(workspacePanelContent);
    }
    Promise.all([loadAllUsers(api), loadWorkspaceMembers(api, workspace.id)]).then(([users, members]) => {
      if (requestId !== state.workspacePanelRequest) return;
      const memberContent = document.querySelector("#workspace-members-content");
      memberContent.innerHTML = workspaceMemberTableMarkup(members, workspace);
      if (canMutate()) bindWorkspaceAccessManager({ root: workspacePanelContent, workspace, members, users, roleTemplateKeys: config.roleTemplateKeys || [], api, openDialog, showToast, enhanceSelect, onChanged: (currentMembers) => {
        const count = currentMembers.length;
        workspace.memberCount = count;
        const summary = state.workspaces.find((item) => item.id === workspace.id);
        if (summary) summary.memberCount = count;
        workspacePanelContent.querySelector(".workspace-access-title .tag").textContent = `${count} member${count === 1 ? "" : "s"}`;
        document.querySelector(`[data-workspace-id="${CSS.escape(workspace.id)}"] [data-workspace-member-count]`)?.replaceChildren(String(count));
      } });
    }).catch(() => {
      if (requestId !== state.workspacePanelRequest) return;
      document.querySelector("#workspace-members-content").innerHTML = workspaceMemberErrorMarkup();
    });
  } catch (error) {
    if (requestId !== state.workspacePanelRequest) return;
    workspacePanelContent.innerHTML = `<div class="panel-error" role="alert"><strong>Unable to load workspace details</strong><p>${escapeText(readableError(error))}</p><button class="button secondary" id="workspace-panel-retry" type="button">Try again</button></div>`;
    document.querySelector("#workspace-panel-retry")?.addEventListener("click", () => openWorkspacePanel(workspaceId));
  }
}

function requestCloseWorkspacePanel() {
  if (history.state?.workspacePanel) history.back();
  else closeWorkspacePanel({ updateHistory: true });
}

function closeWorkspacePanel({ updateHistory = false } = {}) {
  if (workspacePanelLayer.hidden) return;
  state.workspacePanelRequest += 1;
  state.workspacePanelId = null;
  if (updateHistory && /^\/workspaces\/[^/]+$/.test(location.pathname)) history.replaceState({}, "", "/workspaces");
  workspacePanelLayer.classList.remove("open");
  appShell.inert = false;
  appShell.removeAttribute("aria-hidden");
  document.querySelectorAll("[data-workspace-id]").forEach((row) => row.setAttribute("aria-selected", "false"));
  const restoreTarget = state.workspacePanelTrigger;
  state.workspacePanelTrigger = null;
  window.setTimeout(() => {
    workspacePanelLayer.hidden = true;
    workspacePanelContent.innerHTML = "";
    if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true });
  }, 180);
}

async function renderUsers(selectedUserId) {
  await renderUserDirectory({ main, selectedUserId, api, state, pageHeader, userRows, emptyTable, openUserPanel, showToast, readableError });
}

async function openUserPanel(userId, { updateHistory = false, trigger = null } = {}) {
  if (updateHistory && location.pathname !== `/users/${userId}`) history.pushState({ userPanel: true }, "", `/users/${userId}`);
  if (trigger) state.userPanelTrigger = trigger;
  state.userPanelId = userId;
  const requestId = ++state.userPanelRequest;
  document.querySelectorAll("[data-user-id]").forEach((row) => row.setAttribute("aria-selected", String(row.dataset.userId === userId)));
  userPanelLayer.hidden = false;
  appShell.inert = true;
  appShell.setAttribute("aria-hidden", "true");
  userPanelContent.innerHTML = '<div class="panel-loading" role="status">Loading user details…</div>';
  document.querySelector("#user-panel-title").textContent = "User Details"; document.querySelector("#user-panel-email").textContent = "Loading user…";
  requestAnimationFrame(() => userPanelLayer.classList.add("open"));
  userPanelClose.focus({ preventScroll: true });

  try {
    const [detail, config] = await Promise.all([
      api(`/users/${encodeURIComponent(userId)}`),
      api("/system/config")
    ]);
    const workspaces = state.workspaces.length ? state.workspaces : await Promise.all(detail.memberships.map(async (membership) => {
      try { return await api(`/workspaces/${encodeURIComponent(membership.workspaceId)}`); }
      catch { return { id: membership.workspaceId, name: membership.workspaceId }; }
    }));
    if (requestId !== state.userPanelRequest) return;
    renderUserPanel(detail, config.roleTemplateKeys || [], workspaces);
  } catch (error) {
    if (requestId !== state.userPanelRequest) return;
    userPanelContent.innerHTML = `<div class="panel-error" role="alert"><strong>Unable to load user details</strong><p>${escapeText(readableError(error))}</p><button class="button secondary" id="user-panel-retry" type="button">Try again</button></div>`;
    document.querySelector("#user-panel-retry")?.addEventListener("click", () => openUserPanel(userId));
  }
}

function renderUserPanel(detail, roleTemplateKeys, workspaces) {
  const user = detail.user;
  document.querySelector("#user-panel-title").textContent = user.displayName; document.querySelector("#user-panel-email").textContent = user.email;
  cleanupMenuControls(userPanelContent);
  userPanelContent.innerHTML = userPanelMarkup(detail, roleTemplateKeys, workspaces);
  if (!canMutate()) hideMutationControls(userPanelContent);
  userPanelContent.querySelectorAll("select").forEach((select) => enhanceSelect(select));
  state.workspaceAccessByUser.set(user.id, new Set(detail.memberships.map((membership) => membership.workspaceId)));
  syncUserWorkspaceCount(user.id, detail.memberships.length);
  if (canMutate()) bindMembershipEditors({ root: userPanelContent, user, roleTemplateKeys, workspaces, api, openDialog, showToast, onAdded: (membership) => {
    detail.memberships.push(membership);
    renderUserPanel(detail, roleTemplateKeys, workspaces);
  }, onRemoved: (remaining, workspaceIds) => {
    detail.memberships = detail.memberships.filter((membership) => workspaceIds.includes(membership.workspaceId));
    state.workspaceAccessByUser.set(user.id, new Set(workspaceIds));
    syncUserWorkspaceCount(user.id, remaining);
  } });
}

function canMutate() { return state.identity?.roles?.includes("platform-admin") === true; }
function hideMutationControls(root) {
  root.querySelectorAll("[data-change-plan], [data-workspace-lifecycle], [data-manage-workspace-access], [data-add-workspace-access], [data-grant-access], [data-update-role], [data-remove-membership]").forEach((element) => { element.hidden = true; });
  root.querySelectorAll("[data-membership-editor] select").forEach((select) => { select.disabled = true; });
}

function syncUserWorkspaceCount(userId, count) {
  const summary = state.users.find((item) => item.id === userId);
  if (summary) summary.workspaceMembershipCount = count;
  document.querySelectorAll("[data-user-id]").forEach((row) => {
    if (row.dataset.userId === userId) row.querySelector("[data-membership-count]").textContent = String(count);
  });
  state.refreshUserDirectory?.();
}

function requestCloseUserPanel() {
  if (history.state?.userPanel) history.back();
  else closeUserPanel({ updateHistory: true });
}

function closeUserPanel({ updateHistory = false } = {}) {
  if (userPanelLayer.hidden) return;
  state.userPanelRequest += 1;
  state.userPanelId = null;
  if (updateHistory && /^\/users\/[^/]+$/.test(location.pathname)) history.replaceState({}, "", "/users");
  userPanelLayer.classList.remove("open");
  appShell.inert = false;
  appShell.removeAttribute("aria-hidden");
  document.querySelectorAll("[data-user-id]").forEach((row) => row.setAttribute("aria-selected", "false"));
  const restoreTarget = state.userPanelTrigger;
  state.userPanelTrigger = null;
  window.setTimeout(() => {
    userPanelLayer.hidden = true;
    userPanelContent.innerHTML = "";
    if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true });
  }, 180);
}

async function changePlan(workspace, knownConfig = null) {
  const config = knownConfig || await loadSystemConfig();
  const plans = config.planCatalog?.plans || [];
  openDialog({ title: `Change ${workspace.name} plan`, description: "Updates the plan and its configured workspace limits without modifying tenant workloads. The change is rejected if current usage exceeds the selected plan.", submit: "Update Plan", fields: `<div class="field"><label for="dialog-plan">Plan</label><select id="dialog-plan" name="planKey">${plans.map((plan) => `<option value="${escapeAttr(plan.key)}" ${workspace.plan.key === plan.key ? "selected" : ""}>${escapeText(plan.name)}</option>`).join("")}</select></div>`, action: async (data) => { const planKey = String(data.get("planKey")); await api(`/workspaces/${encodeURIComponent(workspace.id)}/plan`, { method: "PATCH", body: { planKey, reason: `Platform admin changed workspace plan from ${workspace.plan.key} to ${planKey}` } }); showToast("Plan successfully updated."); router(); } });
}

async function loadSystemConfig() {
  if (!state.systemConfig) state.systemConfig = await api("/system/config");
  return state.systemConfig;
}

function changeWorkspaceLifecycle(workspace) {
  const restoring = workspace.lifecycleStatus === "suspended";
  const action = async (data) => {
    const lifecycleAction = restoring ? "restore" : "suspend";
    const verb = restoring ? "restored" : "suspended";
    await api(`/workspaces/${encodeURIComponent(workspace.id)}/${lifecycleAction}`, { method: "POST", body: { workspaceName: data.get("workspaceName"), reason: `Platform admin ${verb} workspace member access` } });
    showToast(`Workspace successfully ${verb}.`);
    router();
  };
  openDialog({ title: `${restoring ? "Restore" : "Suspend"} ${workspace.name}`, description: restoring ? "Restores member access using the retained memberships. This does not start, stop, or modify workloads." : "Suspension blocks member access while retaining memberships, targets, workloads, references, and audit history. It does not stop or modify workloads.", submit: `${restoring ? "Restore" : "Suspend"} Workspace`, danger: !restoring, submitDisabled: true, fields: `<div class="field"><label for="dialog-workspace-name">Type <strong>${escapeText(workspace.name)}</strong> to confirm</label><input class="input" id="dialog-workspace-name" name="workspaceName" autocomplete="off" required aria-describedby="workspace-name-confirmation"></div><p class="confirmation-hint" id="workspace-name-confirmation">The name must match exactly.</p>`, action });
  state.dialogAction = action;
  const confirmation = document.querySelector("#dialog-workspace-name");
  const submitButton = document.querySelector("#dialog-submit");
  confirmation.addEventListener("input", () => { submitButton.disabled = confirmation.value !== workspace.name; });
}

function openDialog({ title, description, submit, fields = "", action, danger = false, submitDisabled = false, validate = null, validationMessage = "Check the entered values and try again." }) {
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-description").textContent = description;
  const dialogFields = document.querySelector("#dialog-fields");
  cleanupMenuControls(dialogFields);
  dialogFields.innerHTML = fields;
  document.querySelectorAll("#dialog-fields select").forEach((select) => enhanceSelect(select));
  document.querySelector("#dialog-error").textContent = "";
  const submitButton = document.querySelector("#dialog-submit");
  submitButton.textContent = submit;
  submitButton.className = `button ${danger ? "danger" : "primary"}`;
  submitButton.disabled = submitDisabled;
  state.dialogAction = async (data) => {
    if (validate && !validate(data)) throw new Error(validationMessage);
    return action(data);
  };
  dialog.showModal();
}

async function handleDialogSubmit(event) {
  event.preventDefault();
  if (!dialogForm.reportValidity() || !state.dialogAction) return;
  const submitButton = document.querySelector("#dialog-submit");
  const original = submitButton.textContent;
  submitButton.disabled = true; submitButton.textContent = "Applying…";
  try { await state.dialogAction(new FormData(dialogForm)); dialog.close(); state.dialogAction = null; }
  catch (error) { document.querySelector("#dialog-error").textContent = readableError(error); }
  finally { submitButton.disabled = false; submitButton.textContent = original; }
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !state.csrfToken) {
    const csrfResponse = await fetch("/admin-console-api/auth/csrf");
    const csrfPayload = await csrfResponse.json();
    if (!csrfResponse.ok || !csrfPayload.csrfToken) throw new Error("Unable to establish administrative request protection");
    state.csrfToken = csrfPayload.csrfToken;
  }
  const response = await fetch(`/admin-console-api${path}`, { method, headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(state.csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "x-csrf-token": state.csrfToken } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const payload = await response.json().catch(() => ({ error: "invalid_response" }));
  if (!response.ok) {
    if (response.status === 401) { location.assign(`/admin-auth/oidc/login?return_to=${encodeURIComponent(location.pathname)}`); await new Promise(() => {}); }
    if (payload.error?.code === "ADMIN_REAUTH_REQUIRED") { location.assign(`/admin-auth/oidc/login?reauthenticate=true&return_to=${encodeURIComponent(location.pathname)}`); await new Promise(() => {}); }
    const error = new Error(payload.error?.message || payload.error?.code || payload.error || "request_failed"); error.status = response.status; error.code = payload.error?.code; throw error;
  }
  return payload;
}

async function logout() {
  if (!state.csrfToken) {
    const response = await fetch("/admin-console-api/auth/csrf");
    const payload = await response.json();
    if (!response.ok || !payload.csrfToken) throw new Error("Unable to establish administrative request protection");
    state.csrfToken = payload.csrfToken;
  }
  await fetch("/admin-auth/logout", { method: "POST", headers: { "x-csrf-token": state.csrfToken } });
  location.assign("/");
}

function pageHeader(title, description, actions = "", className = "") { return `<header class="page-header${className ? ` ${escapeAttr(className)}` : ""}"><div><h1>${escapeText(title)}</h1><p class="lede">${escapeText(description)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>`; }
function userRows(items, selectedUserId = null) { return items.map((user) => `<tr data-user-id="${escapeAttr(user.id)}" tabindex="0" aria-selected="${String(user.id === selectedUserId)}"><td><span class="primary-cell">${escapeText(user.displayName)}</span></td><td>${escapeText(user.email)}</td><td><span class="status verification-status ${user.emailVerified ? "verified" : "unverified"}">${user.emailVerified ? "Verified" : "Unverified"}</span></td><td>${escapeText(user.authMethods.join(", ") || "none")}</td><td data-membership-count>${user.workspaceMembershipCount}</td><td>${escapeText(formatDate(user.createdAt))}</td></tr>`).join(""); }
function emptyTable(message, columns) { return `<tr><td colspan="${columns}"><div class="empty-state"><strong>No results</strong>${escapeText(message)}</div></td></tr>`; }
function errorView(error) { return `${pageHeader("Unable to open this view", "The governance service did not return a usable response.")}<section class="ledger empty-state"><strong>${escapeText(readableError(error))}</strong><p>No privileged action was attempted.</p><button class="button primary" id="retry">Try again</button></section>`; }
function readableError(error) { return String(error?.message || "request_failed").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function labelStatus(value) { return String(value || "unknown").replaceAll("_", " "); }
function formatDate(value) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function escapeAttr(value) { return escapeText(value); }
function toggleMenu(open) { sidebar.classList.toggle("open", open); menuButton.setAttribute("aria-expanded", String(open)); scrim.hidden = !open; }

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("tr[data-user-id]")) openUserPanel(event.target.dataset.userId, { updateHistory: true, trigger: event.target });
  if (event.key === "Enter" && event.target.matches("tr[data-workspace-id]")) openWorkspacePanel(event.target.dataset.workspaceId, { updateHistory: true, trigger: event.target });
  if (event.key === "Enter" && event.target.matches("tr[data-href]")) navigate(event.target.dataset.href);
  if (event.key === "Escape" && !workspacePanelLayer.hidden && !dialog.open) requestCloseWorkspacePanel();
  else if (event.key === "Escape" && !userPanelLayer.hidden && !dialog.open) requestCloseUserPanel();
  else if (event.key === "Escape") toggleMenu(false);
  if (event.key === "Tab" && !workspacePanelLayer.hidden && !dialog.open) trapFocus(event, workspacePanel);
  else if (event.key === "Tab" && !userPanelLayer.hidden && !dialog.open) trapFocus(event, userPanel);
});
