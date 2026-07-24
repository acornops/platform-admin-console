const ADMIN_PAGE_LIMIT = 100;
const ROLE_RANK = new Map([
  ["owner", 0],
  ["admin", 1],
  ["workspace_admin", 1],
  ["member", 2],
  ["auditor", 3],
  ["viewer", 4]
]);

export async function loadWorkspaceMembers(api, workspaceId) {
  const params = new URLSearchParams({ limit: String(ADMIN_PAGE_LIMIT) });
  let page = await api(`/workspaces/${encodeURIComponent(workspaceId)}/members?${params}`);
  const members = [...page.items];
  while (page.nextCursor) {
    params.set("cursor", page.nextCursor);
    page = await api(`/workspaces/${encodeURIComponent(workspaceId)}/members?${params}`);
    members.push(...page.items);
  }
  return members.sort(compareMembers);
}

export async function loadAllUsers(api) {
  const params = new URLSearchParams({ limit: String(ADMIN_PAGE_LIMIT) });
  let page = await api(`/users?${params}`);
  const users = [...page.items];
  while (page.nextCursor) {
    params.set("cursor", page.nextCursor);
    page = await api(`/users?${params}`);
    users.push(...page.items);
  }
  return users;
}

function compareMembers(left, right) {
  const roleDifference = roleRank(left.role) - roleRank(right.role);
  if (roleDifference) return roleDifference;
  const roleNameDifference = String(left.role).localeCompare(String(right.role));
  return roleNameDifference || left.displayName.localeCompare(right.displayName) || left.email.localeCompare(right.email);
}

function roleRank(role) { return ROLE_RANK.get(String(role).toLowerCase()) ?? 100; }
