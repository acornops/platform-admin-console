export function userPanelMarkup(detail, roleTemplateKeys, workspaces) {
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const roles = [...new Set(roleTemplateKeys.map(String))];
  const memberships = [...detail.memberships].sort((first, second) => {
    const firstName = workspaceById.get(first.workspaceId)?.name || first.workspaceId;
    const secondName = workspaceById.get(second.workspaceId)?.name || second.workspaceId;
    return firstName.localeCompare(secondName);
  });
  const availableWorkspaceCount = workspaces.filter((workspace) => !memberships.some((membership) => membership.workspaceId === workspace.id)).length;
  const canGrantAccess = availableWorkspaceCount > 0 && roles.length > 0;
  return `
    <section class="panel-section user-details-section" aria-labelledby="user-details-heading">
      <div class="panel-section-heading"><h3 id="user-details-heading">User Details</h3></div>
      <dl class="panel-definition-grid">
        ${definition("User ID", detail.user.id, "mono")}
        ${definition("Auth methods", detail.authMethods.map((method) => method.type).join(", ") || "None")}
        ${definition("Created", formatDate(detail.user.createdAt))}
      </dl>
    </section>
    <section class="panel-section membership-section" aria-labelledby="memberships-heading">
      <div class="panel-section-heading membership-section-heading">
        <h3 id="memberships-heading">Workspace Access</h3>
        <div class="membership-section-actions">
          <span id="membership-count">${memberships.length} workspace${memberships.length === 1 ? "" : "s"}</span>
          <button class="button secondary grant-workspace-access" type="button" data-grant-access data-total-workspaces="${workspaces.length}"${canGrantAccess ? "" : " disabled"}${canGrantAccess ? "" : ' title="No additional workspace access is available"'}>Grant Access</button>
        </div>
      </div>
      <div class="membership-list" data-membership-list>
        ${memberships.map((membership, index) => membershipEditor({ membership, workspace: workspaceById.get(membership.workspaceId), roles, index })).join("") || '<div class="panel-empty"><strong>No Workspace Access</strong><p>This user does not currently have access to a workspace.</p></div>'}
      </div>
    </section>`;
}

export function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function membershipEditor({ membership, workspace, roles, index }) {
  const roleOptions = roles.includes(membership.role) ? roles : [membership.role, ...roles];
  const addedDate = formatDate(membership.createdAt), updatedDate = formatDate(membership.updatedAt);
  const workspaceName = workspace?.name || membership.workspaceId;
  return `<article class="membership-editor" data-membership-editor data-current-role="${escapeAttr(membership.role)}" data-workspace-id="${escapeAttr(membership.workspaceId)}" data-workspace-name="${escapeAttr(workspaceName)}">
    <div class="membership-heading">
      <div><h4>${escapeText(workspaceName)}</h4><span class="secondary-cell">${escapeText(membership.workspaceId)}</span></div>
    </div>
    <div class="membership-role-control">
      <div class="field compact-field"><label for="membership-role-${index}">Workspace Role</label><select id="membership-role-${index}">${roleOptions.map((role) => `<option value="${escapeAttr(role)}" ${role === membership.role ? "selected" : ""}>${escapeText(titleCase(role))}</option>`).join("")}</select></div>
      <button class="button secondary" type="button" data-update-role disabled>Update Role</button>
      <button class="membership-revoke tooltip-button" type="button" data-remove-membership data-tooltip="Revoke workspace access" aria-label="Revoke workspace access from ${escapeAttr(workspaceName)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M18 11h4"/></svg></button>
    </div>
    <div class="membership-footer"><p class="membership-meta"><span>Added <time datetime="${escapeAttr(membership.createdAt)}" data-membership-added>${escapeText(addedDate)}</time></span><span data-membership-updated-item${addedDate === updatedDate ? " hidden" : ""}>Updated <time datetime="${escapeAttr(membership.updatedAt)}" data-membership-updated>${escapeText(updatedDate)}</time></span></p></div>
  </article>`;
}

function definition(term, description, className = "") { return `<div><dt>${escapeText(term)}</dt><dd class="${escapeAttr(className)}">${escapeText(String(description))}</dd></div>`; }
function titleCase(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function escapeAttr(value) { return escapeText(value); }
