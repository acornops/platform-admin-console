export function workspaceOverview(workspaces) {
  return {
    workspaceCount: workspaces.length,
    suspendedWorkspaceCount: workspaces.filter(item => item.lifecycleStatus === "suspended").length,
    kubernetesCount: workspaces.reduce((sum, item) => sum + item.clusterCount, 0),
    virtualMachineCount: workspaces.reduce((sum, item) => sum + item.virtualMachineCount, 0),
    environmentLeaders: [...workspaces]
      .sort((a, b) => b.clusterCount + b.virtualMachineCount - a.clusterCount - a.virtualMachineCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).slice(0, 3)
      .map(({ id, name, clusterCount, virtualMachineCount }) => ({ id, name, clusterCount, virtualMachineCount }))
  };
}

export function userDetailWithWorkspaces(detail, workspaces) {
  return { ...detail, memberships: detail.memberships.map(member => {
    const workspace = workspaces.find(item => item.id === member.workspaceId);
    return { ...member, workspaceName: workspace?.name, workspaceLifecycleStatus: workspace?.lifecycleStatus };
  }) };
}

export function detail(summary, memberships) { return { user: { id: summary.id, email: summary.email, displayName: summary.displayName, createdAt: summary.createdAt, emailVerified: summary.emailVerified }, authMethods: summary.authMethods.map((type) => ({ type })), memberships }; }

export function user(id, email, displayName, createdAt, emailVerified, authMethods, workspaceMembershipCount, lastLoginAt) {
  return { id, email, displayName, createdAt, emailVerified, authMethods, workspaceMembershipCount, ...(lastLoginAt ? { lastLoginAt } : {}) };
}

export function quotaCounts(item) { return { members: item.quota.members.used, kubernetesClusters: item.quota.kubernetesClusters.used, virtualMachines: item.quota.virtualMachines.used }; }
export function quotaFlags(item, limits) { return Object.fromEntries(["members", "kubernetesClusters", "virtualMachines"].map((key) => [key, item.quota[key].used > limits[key]])); }
