import { workspaceMemberTableMarkup } from "./workspace-panel-view.js";

export function bindWorkspaceAccessManager({ root, workspace, members, users, roleTemplateKeys, api, openDialog, showToast, enhanceSelect, onChanged }) {
  const button = root.querySelector("[data-manage-workspace-access]");
  const addButton = root.querySelector("[data-add-workspace-access]");
  const content = root.querySelector("#workspace-members-content");
  let managing = false;

  button.addEventListener("click", () => {
    managing = !managing;
    button.textContent = managing ? "Done" : "Manage Access";
    button.setAttribute("aria-pressed", String(managing));
    addButton.hidden = !managing;
    content.closest(".workspace-members-section").classList.toggle("managing-access", managing);
    render();
    if (managing) addButton.focus({ preventScroll: true });
  });
  addButton.addEventListener("click", grantAccess);

  function render() {
    if (!managing) {
      content.innerHTML = workspaceMemberTableMarkup(members, workspace);
      return;
    }
    content.innerHTML = managementMarkup(members, workspace, roleTemplateKeys);
    content.querySelectorAll("select").forEach((select) => enhanceSelect(select));
    bindManagementControls();
  }

  function bindManagementControls() {
    content.querySelectorAll("[data-workspace-member-editor]").forEach((editor) => {
      const select = editor.querySelector("select");
      const update = editor.querySelector("[data-update-workspace-role]");
      select.addEventListener("change", () => { update.disabled = select.value === editor.dataset.currentRole; });
      update.addEventListener("click", () => updateRole(editor, select, update));
      editor.querySelector("[data-revoke-member]")?.addEventListener("click", () => revokeMember(editor));
    });
  }

  function grantAccess() {
    const memberIds = new Set(members.map((member) => member.userId));
    const availableUsers = users.filter((user) => !memberIds.has(user.id)).sort((left, right) => left.displayName.localeCompare(right.displayName));
    const roles = uniqueRoles(roleTemplateKeys);
    if (!availableUsers.length || !roles.length) return;
    const defaultRole = roles.includes("member") ? "member" : roles[0];
    openDialog({
      title: `Add access to ${workspace.name}`,
      description: "Select an existing user and workspace role. This does not create a user account.",
      submit: "Add Access",
      fields: `<div class="field"><label for="dialog-user">User</label><select id="dialog-user" name="userId" required>${availableUsers.map((user) => `<option value="${escapeText(user.id)}">${escapeText(user.displayName)} · ${escapeText(user.email)}</option>`).join("")}</select></div><div class="field"><label for="dialog-role">Workspace Role</label><select id="dialog-role" name="role" required>${roles.map((role) => `<option value="${escapeText(role)}"${role === defaultRole ? " selected" : ""}>${escapeText(titleCase(role))}</option>`).join("")}</select></div>`,
      action: async (data) => {
        const userId = String(data.get("userId"));
        const role = String(data.get("role"));
        const user = availableUsers.find((item) => item.id === userId);
        const added = await api(`/workspaces/${encodeURIComponent(workspace.id)}/members`, { method: "POST", body: { userId, role, createUserIfMissing: false, reason: `Platform admin granted ${titleCase(role)} access to ${workspace.name}` } });
        members.push({ ...added, userId, displayName: user?.displayName || userId, email: user?.email || "" });
        refresh(`${user?.displayName || userId} now has access to ${workspace.name}.`);
      }
    });
  }

  async function updateRole(editor, select, button) {
    const previousRole = editor.dataset.currentRole;
    const nextRole = select.value;
    if (previousRole === nextRole) return;
    button.disabled = true; select.disabled = true; button.textContent = "Updating…";
    try {
      const updated = await api(memberPath(editor) + "/role", { method: "PATCH", body: { role: nextRole, reason: `Platform admin changed workspace role from ${titleCase(previousRole)} to ${titleCase(nextRole)}` } });
      const member = members.find((item) => item.userId === editor.dataset.memberUserId);
      if (member) Object.assign(member, updated, { role: nextRole });
      refresh(`${editor.dataset.userName}'s role is now ${titleCase(nextRole)}.`);
    } catch (error) {
      button.disabled = false; select.disabled = false; button.textContent = "Update Role";
      showToast(`Unable to update role: ${readableError(error)}`, "danger");
    }
  }

  function revokeMember(editor) {
    openDialog({
      title: `Revoke ${editor.dataset.userName}'s access?`,
      description: `This removes ${editor.dataset.userName} from ${workspace.name}. Their other workspace access remains unchanged.`,
      submit: "Revoke Access", danger: true,
      action: async () => {
        await api(memberPath(editor), { method: "DELETE", body: { reason: "Platform admin removed workspace membership" } });
        removeMember(editor.dataset.memberUserId);
        refresh(`${editor.dataset.userName}'s access was revoked.`);
      }
    });
  }

  function removeMember(userId) { const index = members.findIndex((member) => member.userId === userId); if (index >= 0) members.splice(index, 1); }
  function memberPath(editor) { return `/workspaces/${encodeURIComponent(workspace.id)}/members/${encodeURIComponent(editor.dataset.memberUserId)}`; }
  function refresh(message, tone = "success") { workspace.memberCount = members.length; onChanged?.(members); render(); showToast(message, tone); }
}

export function managementMarkup(members, workspace, roleTemplateKeys) {
  const roles = uniqueRoles(roleTemplateKeys);
  const ownerCount = members.filter((member) => member.role === "owner").length;
  return `<div class="workspace-access-editor-list">${members.map((member, index) => memberEditor(member, roles, index, workspace, ownerCount)).join("") || '<div class="workspace-members-empty"><strong>No workspace access</strong><p>Add an existing user to this workspace.</p></div>'}</div>`;
}

function memberEditor(member, roles, index, workspace, ownerCount) {
  const lastOwner = member.role === "owner" && ownerCount === 1;
  const options = roles.includes(member.role) ? roles : [member.role, ...roles];
  return `<article class="workspace-access-editor" data-workspace-member-editor data-member-user-id="${escapeText(member.userId)}" data-user-name="${escapeText(member.displayName)}" data-current-role="${escapeText(member.role)}"><div class="workspace-access-identity"><strong>${escapeText(member.displayName)}</strong><span>${escapeText(member.email)}</span></div><div class="workspace-access-role"><select id="workspace-role-${index}" aria-label="Role for ${escapeText(member.displayName)}"${lastOwner ? " disabled" : ""}>${options.map((role) => `<option value="${escapeText(role)}"${role === member.role ? " selected" : ""}>${escapeText(titleCase(role))}</option>`).join("")}</select></div><button class="button secondary" type="button" data-update-workspace-role disabled>Update Role</button><button class="membership-revoke tooltip-button" type="button" data-revoke-member data-tooltip="${lastOwner ? "The last owner cannot be revoked" : "Revoke workspace access"}" aria-label="Revoke ${escapeText(member.displayName)}'s access to ${escapeText(workspace.name)}"${lastOwner ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M18 11h4"/></svg></button>${lastOwner ? '<p class="workspace-owner-note">The last owner must retain access.</p>' : ""}</article>`;
}

function uniqueRoles(values) { return [...new Set(values.map(String))]; }
function titleCase(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function readableError(error) { return String(error?.message || "request_failed").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
