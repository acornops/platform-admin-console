export function bindMembershipEditors({ root, user, roleTemplateKeys, workspaces, api, openDialog, showToast, onAdded, onRemoved }) {
  root.querySelectorAll("[data-membership-editor]").forEach((editor) => {
    const select = editor.querySelector("select");
    const updateButton = editor.querySelector("[data-update-role]");
    select.addEventListener("change", () => { updateButton.disabled = select.value === editor.dataset.currentRole; });
    updateButton.addEventListener("click", () => updateRole({ editor, user, select, button: updateButton, api, showToast }));
    editor.querySelector("[data-remove-membership]").addEventListener("click", () => confirmRemoval({ root, editor, user, api, openDialog, showToast, onRemoved }));
  });
  root.querySelector("[data-grant-access]")?.addEventListener("click", () => grantAccess({ root, user, roleTemplateKeys, workspaces, api, openDialog, showToast, onAdded }));
}

function grantAccess({ root, user, roleTemplateKeys, workspaces, api, openDialog, showToast, onAdded }) {
  const currentWorkspaceIds = new Set([...root.querySelectorAll("[data-membership-editor]")].map((editor) => editor.dataset.workspaceId));
  const availableWorkspaces = workspaces.filter((workspace) => !currentWorkspaceIds.has(workspace.id)).sort((first, second) => first.name.localeCompare(second.name));
  const roles = [...new Set(roleTemplateKeys.map(String))];
  if (!availableWorkspaces.length || !roles.length) return;
  const defaultRole = roles.includes("member") ? "member" : roles[0];

  openDialog({
    title: `Grant workspace access to ${user.displayName}`,
    description: "Select a workspace and role. This changes workspace access only.",
    submit: "Grant Access",
    fields: `<div class="field"><label for="dialog-workspace">Workspace</label><select id="dialog-workspace" name="workspaceId" required>${availableWorkspaces.map((workspace) => `<option value="${escapeText(workspace.id)}">${escapeText(workspace.name)}</option>`).join("")}</select></div><div class="field"><label for="dialog-role">Workspace Role</label><select id="dialog-role" name="role" required>${roles.map((role) => `<option value="${escapeText(role)}"${role === defaultRole ? " selected" : ""}>${escapeText(titleCase(role))}</option>`).join("")}</select></div>`,
    action: async (data) => {
      const workspaceId = String(data.get("workspaceId"));
      const workspace = availableWorkspaces.find((item) => item.id === workspaceId);
      const role = String(data.get("role"));
      const added = await api(`/workspaces/${encodeURIComponent(workspaceId)}/members`, {
        method: "POST",
        body: {
          userId: user.id,
          role,
          createUserIfMissing: false,
          reason: `Platform admin granted ${titleCase(role)} access to ${workspace?.name || workspaceId}`
        }
      });
      onAdded?.(added);
      showToast(`Access to ${workspace?.name || workspaceId} successfully granted.`);
    }
  });
}

async function updateRole({ editor, user, select, button, api, showToast }) {
  const previousRole = editor.dataset.currentRole, nextRole = select.value;
  if (previousRole === nextRole) return;
  button.disabled = true; select.disabled = true; button.textContent = "Updating…";
  try {
    const updated = await api(memberPath(editor, user) + "/role", { method: "PATCH", body: { role: nextRole, reason: `Platform admin changed workspace role from ${titleCase(previousRole)} to ${titleCase(nextRole)}` } });
    editor.dataset.currentRole = nextRole;
    const updatedTime = editor.querySelector("[data-membership-updated]"), updatedDate = formatDate(updated.updatedAt);
    updatedTime.textContent = updatedDate; updatedTime.dateTime = updated.updatedAt;
    editor.querySelector("[data-membership-updated-item]").hidden = updatedDate === editor.querySelector("[data-membership-added]").textContent;
    showToast(`Role successfully updated to ${titleCase(nextRole)}.`);
  } catch (error) {
    button.disabled = false;
    showToast(`Unable to update role: ${readableError(error)}`, "danger");
  } finally {
    select.disabled = false; button.textContent = "Update Role";
  }
}

function confirmRemoval({ root, editor, user, api, openDialog, showToast, onRemoved }) {
  const workspaceName = editor.dataset.workspaceName;
  const isOwner = editor.dataset.currentRole === "owner";
  openDialog({
    title: `Revoke access to ${workspaceName}?`,
    description: `This removes ${user.displayName}'s access to ${workspaceName}. Other workspace access remains unchanged.`,
    submit: "Revoke Access", danger: true, fields: isOwner ? ownerSafeguard("Transfer ownership before revoking this workspace access.") : "", submitDisabled: isOwner,
    action: async () => {
      await api(memberPath(editor, user), { method: "DELETE", body: { reason: "Platform admin removed workspace membership" } });
      editor.remove();
      syncAccessState({ root, onRemoved });
      showToast(`Access to ${workspaceName} successfully revoked.`);
    }
  });
}

function syncAccessState({ root, onRemoved }) {
  const list = root.querySelector("[data-membership-list]");
  const remaining = list.querySelectorAll("[data-membership-editor]").length;
  root.querySelector("#membership-count").textContent = `${remaining} workspace${remaining === 1 ? "" : "s"}`;
  const grantAccess = root.querySelector("[data-grant-access]");
  if (grantAccess) grantAccess.disabled = remaining >= Number(grantAccess.dataset.totalWorkspaces || 0);
  if (!remaining) list.innerHTML = '<div class="panel-empty"><strong>No Workspace Access</strong><p>This user does not currently have access to a workspace.</p></div>';
  const workspaceIds = [...list.querySelectorAll("[data-membership-editor]")].map((editor) => editor.dataset.workspaceId);
  onRemoved?.(remaining, workspaceIds);
  return remaining;
}

function ownerSafeguard(message, workspaceNames = []) { return `<div class="notice owner-safeguard"><strong>Owner safeguard</strong><p>${escapeText(message)}</p>${workspaceNames.length ? `<ul>${workspaceNames.map((name) => `<li>${escapeText(name)}</li>`).join("")}</ul>` : ""}</div>`; }

function memberPath(editor, user) { return `/workspaces/${encodeURIComponent(editor.dataset.workspaceId)}/members/${encodeURIComponent(user.id)}`; }
function titleCase(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function readableError(error) { return String(error?.message || "request_failed").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
