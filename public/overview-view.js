export function overviewMarkup({ workspaces, users, pageHeader }) {
  const model = buildOverviewModel({ workspaces, users });
  return `
    ${pageHeader("Platform insights", "A governance-safe view of platform adoption, access, and portfolio health.")}
    <section class="overview-report" aria-labelledby="platform-footprint-heading">
      <div class="overview-report-heading"><div><h2 id="platform-footprint-heading">Platform footprint</h2><p>Current totals across the complete governance catalog.</p></div></div>
      <dl class="footprint-metrics">
        ${metric(model.workspaceCount, "Workspaces", "Active platform customers and internal teams")}
        ${metric(model.userCount, "Users", `${model.verifiedPercent}% identity verification`)}
        ${metric(model.environmentCount, "Connected environments", `${model.kubernetesCount} Kubernetes · ${model.virtualMachineCount} VMs`)}
      </dl>
    </section>
    <div class="overview-analysis-grid">
      <section class="overview-section workspace-leaders" aria-labelledby="workspace-leaders-heading">
        <div class="overview-section-heading"><div><h2 id="workspace-leaders-heading">Most connected environments</h2><p>Workspaces with the largest connected footprint.</p></div><a href="/workspaces">Explore workspaces →</a></div>
        ${leaderboard(model.environmentLeaders, (workspace) => `${workspace.environmentCount} total (${workspace.clusterCount} cluster${workspace.clusterCount === 1 ? "" : "s"} · ${workspace.virtualMachineCount} VM${workspace.virtualMachineCount === 1 ? "" : "s"})`)}
      </section>
      <section class="overview-section product-signals" aria-labelledby="product-signals-heading">
        <div class="overview-section-heading"><h2 id="product-signals-heading">Product signals</h2></div>
        <article class="signal-row"><div class="signal-marker ${model.suspendedWorkspaceCount ? "attention" : "healthy"}">${model.suspendedWorkspaceCount}</div><div><h3>${model.suspendedWorkspaceCount} suspended workspace${model.suspendedWorkspaceCount === 1 ? "" : "s"}</h3><p>${model.suspendedWorkspaceCount ? `${model.suspendedWorkspaceCount} of ${model.workspaceCount} workspaces ${model.suspendedWorkspaceCount === 1 ? "has" : "have"} suspended member access.` : `All ${model.workspaceCount} workspaces are currently available to members.`} <a href="/workspaces">Review workspaces →</a></p></div></article>
        <article class="signal-row"><div class="signal-marker ${model.unverifiedUserCount ? "attention" : "healthy"}">${model.unverifiedUserCount}</div><div><h3>${model.unverifiedUserCount ? "Identity verification needs follow-up" : "All identities are verified"}</h3><p>${model.unverifiedUserCount ? `${model.unverifiedUserCount} user account${model.unverifiedUserCount === 1 ? " remains" : "s remain"} unverified.` : "Every current user account has completed verification."} <a href="/users">Review users →</a></p></div></article>
        <article class="signal-row"><div class="signal-marker neutral">${model.topEnvironmentShare}%</div><div><h3>Connected environments are concentrated in ${escapeText(model.environmentLeaders[0]?.name || "no workspace")}</h3><p>${model.environmentLeaders[0] ? `${model.environmentLeaders[0].name} accounts for ${model.topEnvironmentShare}% of all connected environments.` : "Connected-environment concentration will appear when workspaces are available."}</p></div></article>
      </section>
    </div>
    <aside class="overview-boundary" aria-label="Data boundary"><svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><strong>Governance data only.</strong><span>No workspace logs or tenant audit events. No targets, agents, sessions, runs, prompts, commands, tools, credentials, or workload changes.</span></aside>`;
}

export function buildOverviewModel({ workspaces, users }) {
  const workspaceCount = workspaces.length;
  const userCount = users.length;
  const kubernetesCount = workspaces.reduce((sum, workspace) => sum + number(workspace.clusterCount), 0);
  const virtualMachineCount = workspaces.reduce((sum, workspace) => sum + number(workspace.virtualMachineCount), 0);
  const environmentCount = kubernetesCount + virtualMachineCount;
  const verifiedUserCount = users.filter((user) => user.emailVerified).length;
  const rankedWorkspaces = workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, clusterCount: number(workspace.clusterCount), virtualMachineCount: number(workspace.virtualMachineCount), environmentCount: number(workspace.clusterCount) + number(workspace.virtualMachineCount) }));
  const environmentLeaders = [...rankedWorkspaces].sort((left, right) => right.environmentCount - left.environmentCount || left.name.localeCompare(right.name)).slice(0, 3);
  return {
    workspaceCount, userCount, kubernetesCount, virtualMachineCount, environmentCount, environmentLeaders,
    topEnvironmentShare: percent(environmentLeaders[0]?.environmentCount || 0, environmentCount),
    suspendedWorkspaceCount: workspaces.filter((workspace) => workspace.lifecycleStatus === "suspended").length,
    verifiedPercent: percent(verifiedUserCount, userCount),
    unverifiedUserCount: userCount - verifiedUserCount
  };
}

function metric(value, label, detail) { return `<div><dt>${escapeText(label)}</dt><dd>${value}</dd><span>${escapeText(detail)}</span></div>`; }
function leaderboard(workspaces, valueLabel) { return `<ol class="leaderboard-group">${workspaces.map((workspace, index) => `<li><span class="leaderboard-rank">${index + 1}</span><a href="/workspaces/${encodeURIComponent(workspace.id)}">${escapeText(workspace.name)}</a><strong>${escapeText(valueLabel(workspace))}</strong></li>`).join("") || '<li class="overview-empty">No workspace data is available.</li>'}</ol>`; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function percent(value, total) { return total ? Math.round((value / total) * 100) : 0; }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
