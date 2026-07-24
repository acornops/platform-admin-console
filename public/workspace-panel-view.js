export function workspacePanelMarkup(workspace, plans = []) {
  const suspended = workspace.lifecycleStatus === "suspended";
  const plan = plans.find((item) => item.key === workspace.plan.key);
  return `
    <section class="panel-section" aria-labelledby="workspace-details-heading">
      <div class="panel-section-heading"><h3 id="workspace-details-heading">Workspace Details</h3></div>
      <dl class="panel-definition-grid">
        ${capacityDefinition("Kubernetes clusters", workspace.clusterCount, plan?.quotas?.kubernetesClusters)}
        ${capacityDefinition("Virtual machines", workspace.virtualMachineCount, plan?.quotas?.virtualMachines)}
        ${planDefinition(workspace.plan.name)}
        ${definition("Created by", workspace.createdBy, "mono")}
        ${definition("Created", formatDate(workspace.createdAt))}
      </dl>
    </section>
    <section class="panel-section workspace-members-section" aria-labelledby="workspace-members-heading">
      <div class="panel-section-heading workspace-members-heading">
        <div><div class="workspace-access-title"><h3 id="workspace-members-heading">Workspace Access</h3><span class="tag">${Number(workspace.memberCount).toLocaleString()} member${Number(workspace.memberCount) === 1 ? "" : "s"}</span></div><p>Members and roles currently assigned to this workspace.</p></div>
        <div class="workspace-members-actions">
          <button class="button secondary" type="button" data-manage-workspace-access aria-pressed="false">Manage Access</button>
          <button class="workspace-add-access tooltip-button" type="button" data-add-workspace-access data-tooltip="Add workspace access" aria-label="Add workspace access" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg></button>
        </div>
      </div>
      <div id="workspace-members-content"><div class="workspace-members-loading" role="status">Loading workspace members…</div></div>
    </section>
    <section class="panel-section workspace-lifecycle-section" aria-labelledby="workspace-lifecycle-heading">
      <div class="panel-section-heading workspace-lifecycle-heading"><h3 id="workspace-lifecycle-heading">Workspace Lifecycle</h3><span class="status workspace-lifecycle-status ${suspended ? "suspended" : "active"}">${suspended ? "Suspended" : "Active"}</span></div>
      <p class="panel-section-copy workspace-lifecycle-copy">${suspended ? "Restore member access using the retained workspace memberships." : "Suspend member access while retaining memberships, targets, workloads, references, and audit history."}</p>
      <p class="action-hint">This action does not stop or modify workloads.</p>
      <button class="button ${suspended ? "secondary" : "danger-secondary"} full-action compact" type="button" data-workspace-lifecycle="${suspended ? "restore" : "suspend"}">${suspended ? "Restore Workspace" : "Suspend Workspace"}</button>
    </section>`;
}

export function workspaceMemberTableMarkup(members, workspace) {
  if (!members.length) return `<div class="workspace-members-empty"><strong>No workspace access</strong><p>Choose Manage Access to grant an existing user access.</p></div>`;
  return `<div class="workspace-members-table-wrap"><table class="workspace-members-table" aria-label="Members with access to ${escapeText(workspace.name)}"><thead><tr><th>User</th><th class="workspace-member-email-column">Email</th><th>Role</th></tr></thead><tbody>${members.map((member) => `<tr><td><a class="workspace-member-link" href="/users/${encodeURIComponent(member.userId)}?workspace=${encodeURIComponent(workspace.name)}">${escapeText(member.displayName)}</a><span class="workspace-member-email-mobile">${escapeText(member.email)}</span></td><td class="workspace-member-email-column">${escapeText(member.email)}</td><td><span class="tag">${escapeText(titleCase(member.role))}</span></td></tr>`).join("")}</tbody></table></div>`;
}

export function workspaceMemberErrorMarkup() {
  return `<div class="workspace-members-error" role="alert"><strong>Unable to load workspace members</strong><p>Try closing and reopening this workspace.</p></div>`;
}

function definition(term, description, className = "") { return `<div><dt>${escapeText(term)}</dt><dd class="${escapeText(className)}">${escapeText(String(description))}</dd></div>`; }
function capacityDefinition(term, used, limit) {
  const numericUsed = Number(used);
  const numericLimit = Number.isFinite(Number(limit)) ? Number(limit) : null;
  const state = numericLimit === null ? "unknown" : numericUsed > numericLimit ? "over-limit" : "within-limit";
  const visibleLimit = numericLimit === null ? "—" : numericLimit.toLocaleString();
  return `<div><dt>${escapeText(term)}</dt><dd><span class="capacity-badge ${state}" aria-label="${numericUsed.toLocaleString()} of ${visibleLimit} connected">${numericUsed.toLocaleString()} / ${visibleLimit}</span></dd></div>`;
}
function planDefinition(planName) { return `<div><dt>Current plan</dt><dd class="workspace-plan-value"><span>${escapeText(planName)}</span><button class="button secondary compact" type="button" data-change-plan>Change Plan</button></dd></div>`; }
function titleCase(value) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
