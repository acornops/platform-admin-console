export type RouteName =
  | 'overview'
  | 'workspaces'
  | 'users'
  | 'settings-workspace'
  | 'settings-ai'
  | 'workspace-defaults'
  | 'audit';

export interface AppRoute {
  name: RouteName;
  path: string;
  resourceId?: string;
}

export function resolveRoute(pathname: string): AppRoute {
  const workspace = /^\/workspaces\/([^/]+)$/.exec(pathname);
  if (workspace) return { name: 'workspaces', path: pathname, resourceId: decodeURIComponent(workspace[1]) };
  const user = /^\/users\/([^/]+)$/.exec(pathname);
  if (user) return { name: 'users', path: pathname, resourceId: decodeURIComponent(user[1]) };
  if (pathname === '/workspaces') return { name: 'workspaces', path: pathname };
  if (pathname === '/users') return { name: 'users', path: pathname };
  if (pathname === '/settings/ai') return { name: 'settings-ai', path: pathname };
  if (pathname === '/settings' || pathname === '/settings/workspace') return { name: 'settings-workspace', path: pathname };
  if (pathname === '/workspace-defaults') return { name: 'workspace-defaults', path: pathname };
  if (pathname === '/audit') return { name: 'audit', path: pathname };
  return { name: 'overview', path: '/' };
}

export function titleCase(value = '') {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatDateOnly(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  }).format(date);
}

export function formatMembershipLifecycle(createdAt?: string, updatedAt?: string) {
  const added = `Added ${formatDateOnly(createdAt)}`;
  if (!updatedAt) return added;

  const createdTime = createdAt ? Date.parse(createdAt) : Number.NaN;
  const updatedTime = Date.parse(updatedAt);
  const wasUpdated = Number.isNaN(createdTime) || Number.isNaN(updatedTime)
    ? updatedAt !== createdAt
    : updatedTime !== createdTime;

  return wasUpdated ? `${added} · Updated ${formatDateOnly(updatedAt)}` : added;
}

export function administratorInitials(identity: any = {}) {
  const source = identity?.displayName || identity?.email || identity?.subject || 'Platform administrator';
  const parts = String(source).trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function workspaceCreatorName(workspace: any = {}) {
  return workspace.createdByDisplayName || workspace.createdByEmail || workspace.createdBy || 'Unknown user';
}

export const roleRank = new Map([
  ['owner', 0],
  ['admin', 1],
  ['member', 2],
  ['auditor', 3],
  ['viewer', 4]
]);

export function sortMembers(items: any[]) {
  return [...items].sort((left, right) => {
    const roleDelta = (roleRank.get(String(left.role).toLowerCase()) ?? 99) - (roleRank.get(String(right.role).toLowerCase()) ?? 99);
    if (roleDelta) return roleDelta;
    return String(left.displayName || left.email || left.userId).localeCompare(String(right.displayName || right.email || right.userId));
  });
}
