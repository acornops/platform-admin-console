import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { PanelsTopLeft, Search, UserMinus, UserRoundPlus, Users } from 'lucide-react';
import {
  Button,
  CloseButton,
  Combobox,
  DataSurface,
  DataTable,
  DataTableFrame,
  DataTableHeaderCell,
  EmptyState,
  FieldLabel,
  InlineAlert,
  LoadingState,
  PageHeader,
  PageSection,
  RightSidePanel,
  Select,
  StatusBadge,
  TextInput
} from '@acornops/ui';
import { adminApi, loadAllPages, readableError } from '../api';
import type { PageProps } from '../app-types';
import { formatDate, formatMembershipLifecycle, titleCase } from '../lib';
import { ActionDialog } from '../components/ActionDialog';

const userPageLimit = 25;
const filterPageLimit = 100;

export function filterUsersByWorkspace(users: any[], accessByUser: Map<string, Set<string>>, workspaces: any[], value: string) {
  const query = value.trim().toLowerCase();
  if (!query) return users;
  const ids = new Set(workspaces.filter((workspace) => [workspace.name, workspace.id].some((field) => String(field || '').toLowerCase().includes(query))).map((workspace) => workspace.id));
  return users.filter((user) => [...(accessByUser.get(user.id) || [])].some((workspaceId) => ids.has(workspaceId)));
}

export function UsersPage(props: PageProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [accessByUser, setAccessByUser] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [verification, setVerification] = useState<'all' | 'verified' | 'unverified'>('all');
  const [workspaceFilter, setWorkspaceFilter] = useState(() => new URLSearchParams(location.search).get('workspace') || '');
  const [nextCursor, setNextCursor] = useState('');
  const nextCursorRef = useRef('');
  const requestSequence = useRef(0);

  const load = useCallback(async ({ append = false }: { append?: boolean } = {}) => {
    if (append && (!nextCursorRef.current || workspaceFilter.trim())) return;
    const requestId = ++requestSequence.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const workspaceQuery = workspaceFilter.trim();
      const params = new URLSearchParams({ limit: String(workspaceQuery ? filterPageLimit : userPageLimit) });
      if (search.trim()) params.set('q', search.trim());
      if (verification !== 'all') params.set('emailVerified', String(verification === 'verified'));
      if (append) params.set('cursor', nextCursorRef.current);
      let page = await adminApi<{ items: any[]; nextCursor?: string }>(`/users?${params}`);
      const loadedUsers = [...(page.items || [])];
      while (workspaceQuery && page.nextCursor) {
        params.set('cursor', page.nextCursor);
        page = await adminApi<{ items: any[]; nextCursor?: string }>(`/users?${params}`);
        loadedUsers.push(...(page.items || []));
      }
      if (requestId !== requestSequence.current) return;

      if (workspaceQuery) {
        const details = await Promise.all(loadedUsers.map(async (user) => {
          try { return [user.id, await adminApi<any>(`/users/${encodeURIComponent(user.id)}`)] as const; }
          catch { return [user.id, null] as const; }
        }));
        if (requestId !== requestSequence.current) return;
        setAccessByUser(new Map(details.map(([id, detail]) => [
          id,
          new Set<string>((detail?.memberships || []).map((membership: any) => membership.workspaceId))
        ])));
      }

      setUsers((current) => append
        ? [...current, ...loadedUsers.filter((user) => !current.some((known) => known.id === user.id))]
        : loadedUsers);
      nextCursorRef.current = workspaceQuery ? '' : page.nextCursor || '';
      setNextCursor(nextCursorRef.current);
    } catch (reason) {
      if (requestId === requestSequence.current) setError(readableError(reason));
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [search, verification, workspaceFilter]);

  useEffect(() => {
    let active = true;
    void loadAllPages<any>('/workspaces')
      .then((items) => { if (active) setWorkspaces(items); })
      .catch((reason) => { if (active) setError(readableError(reason)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 240);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = users.filter((user) => !query || [user.displayName, user.email, user.id].some((field) => String(field || '').toLowerCase().includes(query)));
    if (verification !== 'all') next = next.filter((user) => Boolean(user.emailVerified) === (verification === 'verified'));
    return filterUsersByWorkspace(next, accessByUser, workspaces, workspaceFilter);
  }, [accessByUser, search, users, verification, workspaceFilter, workspaces]);

  return (
    <>
      <PageHeader title="Users" description="Review identity and workspace access for AcornOps users." />
      <DataSurface toolbarFullWidth toolbar={
        <div className="grid w-full min-w-0 gap-2 md:grid-cols-[minmax(9rem,1.25fr)_minmax(10rem,1fr)_10.5rem_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ui-text-muted" aria-hidden="true" />
            <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or ID" className="pl-10" />
          </label>
          <Combobox
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
            ariaLabel="Filter users by workspace"
            placeholder="Filter workspace name or ID"
            leadingIcon={<PanelsTopLeft className="h-4 w-4" aria-hidden="true" />}
            options={workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name, meta: workspace.id }))}
          />
          <Select value={verification} onChange={setVerification} ariaLabel="Filter users by verification" options={[
            { value: 'all', label: 'All verification' },
            { value: 'verified', label: 'Verified' },
            { value: 'unverified', label: 'Unverified' }
          ]} />
          <StatusBadge className="h-11 justify-center whitespace-nowrap px-4 tabular-nums">
            Showing {visibleUsers.length} of {users.length}{nextCursor ? ' loaded' : ''}
          </StatusBadge>
        </div>
      }>
        {loading && !users.length ? <LoadingState label="Loading users" /> : error && !users.length ? <div className="p-5"><InlineAlert tone="danger">{error}</InlineAlert></div> : visibleUsers.length ? (
          <>
            <DataTableFrame aria-busy={loading || loadingMore}>
              <DataTable caption="Users">
                <thead><tr>
                  <DataTableHeaderCell density="compact">User</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Workspaces</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Status</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Created</DataTableHeaderCell>
                </tr></thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.id} className="data-row cursor-pointer" aria-selected={props.resourceId === user.id} tabIndex={0} onClick={() => props.navigate(`/users/${encodeURIComponent(user.id)}`)} onKeyDown={(event) => { if (event.key === 'Enter') props.navigate(`/users/${encodeURIComponent(user.id)}`); }}>
                      <td data-primary="true" data-label="User" className="px-5 py-4"><strong className="block text-sm text-ui-text">{user.displayName || user.email}</strong><span className="block break-all text-xs text-ui-text-muted">{user.email}</span></td>
                      <td data-label="Workspaces" className="px-5 py-4 text-sm tabular-nums text-ui-text">{accessByUser.get(user.id)?.size ?? user.workspaceMembershipCount ?? 0}</td>
                      <td data-label="Status" className="px-5 py-4">
                        {user.emailVerified ? (
                          <StatusBadge tone="success" className="gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden="true" />
                            Verified
                          </StatusBadge>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-readable">
                            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                            Unverified
                          </span>
                        )}
                      </td>
                      <td data-label="Created" className="px-5 py-4 text-sm text-ui-text-muted">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableFrame>
            {nextCursor && !workspaceFilter.trim() && (
              <div className="flex justify-center border-t border-ui-border p-4">
                <Button onClick={() => void load({ append: true })} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
            {error && <div className="p-4"><InlineAlert tone="danger">Unable to load more users. {error}</InlineAlert></div>}
          </>
        ) : <EmptyState embedded icon={<Users />} title="No Users Found" description="No users match the current search or filters." />}
      </DataSurface>
      {props.resourceId && <UserPanel {...props} userId={props.resourceId} workspaces={workspaces} onClose={() => props.navigate('/users', { replace: true })} onChanged={() => void load()} />}
    </>
  );
}

function UserPanel({ userId, workspaces, onClose, onChanged, navigate, notify, canMutate }: PageProps & {
  userId: string;
  workspaces: any[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [dialog, setDialog] = useState<'grant' | 'revoke' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [rolePendingWorkspaceId, setRolePendingWorkspaceId] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try {
      const [userDetail, systemConfig] = await Promise.all([adminApi(`/users/${encodeURIComponent(userId)}`), adminApi('/system/config')]);
      setDetail(userDetail);
      setConfig(systemConfig);
      setRoleDrafts(Object.fromEntries((userDetail.memberships || []).map((membership: any) => [membership.workspaceId, membership.role])));
    } catch (reason) { setError(readableError(reason)); }
  }, [userId]);
  useEffect(() => { void reload(); }, [reload]);

  const memberships = useMemo(() => {
    const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    return [...(detail?.memberships || [])].map((membership) => ({ ...membership, workspace: byId.get(membership.workspaceId) || { id: membership.workspaceId, name: membership.workspaceId } })).sort((left, right) => left.workspace.name.localeCompare(right.workspace.name));
  }, [detail, workspaces]);
  const user = detail?.user;
  const updateMembershipRole = async (membership: any, nextRole: string) => {
    setAccessError('');
    setRolePendingWorkspaceId(membership.workspaceId);
    try {
      await adminApi(`/workspaces/${encodeURIComponent(membership.workspaceId)}/members/${encodeURIComponent(user.id)}/role`, {
        method: 'PATCH',
        body: {
          role: nextRole,
          reason: `Platform admin changed workspace role from ${titleCase(membership.role)} to ${titleCase(nextRole)}`
        }
      });
      await reload();
      notify(`Role successfully updated to ${titleCase(nextRole)}.`);
    } catch (reason) {
      setAccessError(readableError(reason));
    } finally {
      setRolePendingWorkspaceId('');
    }
  };

  return (
    <RightSidePanel isOpen onClose={onClose} titleId="user-panel-title">
      <header className="flex items-start justify-between gap-3 border-b border-ui-border bg-ui-bg px-4 py-3 sm:px-5">
        <div className="min-w-0"><h2 id="user-panel-title" className="truncate text-lg font-semibold text-ui-text">{user?.displayName || 'User Details'}</h2><p className="truncate text-xs text-ui-text-muted">{user?.email || 'Loading user…'}</p></div>
        <CloseButton aria-label="Close user details" onClick={onClose} />
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {!detail && !error ? <LoadingState label="Loading user details" /> : error ? <div className="p-4 sm:p-6"><InlineAlert tone="danger">{error}</InlineAlert></div> : (
          <>
            <section className="px-4 py-3 sm:px-5">
              <h2 className="type-panel-title">User Details</h2>
              <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem term="User ID"><span className="mono">{user.id}</span></DetailItem>
                <DetailItem term="Auth Methods">{detail.authMethods?.map((method: any) => titleCase(method.type)).join(', ') || 'None'}</DetailItem>
                <DetailItem term="Created">{formatDate(user.createdAt)}</DetailItem>
              </dl>
            </section>
            <PageSection
              compact
              title={(
                <span className="flex flex-wrap items-center gap-2">
                  Workspace Access
                  <StatusBadge className="rounded-md px-2.5 py-1 tabular-nums">
                    {memberships.length} workspace{memberships.length === 1 ? '' : 's'}
                  </StatusBadge>
                </span>
              )}
              description="Workspaces and roles currently assigned to this user."
              className="!mt-0 px-4 py-3 sm:px-5"
              actions={canMutate && <Button size="sm" onClick={() => setDialog('grant')} disabled={memberships.length >= workspaces.length}><UserRoundPlus className="h-4 w-4" /> Grant Access</Button>}
            >
              {accessError && <InlineAlert tone="danger" className="mb-3">{accessError}</InlineAlert>}
              {memberships.length ? (
                <DataTableFrame className="-mx-4 border-t border-ui-border sm:-mx-5">
                  <DataTable caption={`Workspace access for ${user.displayName || user.email}`} className="min-w-[40rem] table-fixed">
                    <thead><tr>
                      <DataTableHeaderCell density="compact" className="w-[42%] font-medium">Workspace</DataTableHeaderCell>
                      <DataTableHeaderCell density="compact" className="w-[58%] font-medium">Role</DataTableHeaderCell>
                    </tr></thead>
                    <tbody className="border-t border-ui-border">
                      {memberships.map((membership) => {
                        const nextRole = roleDrafts[membership.workspaceId] ?? membership.role;
                        const roleChanged = nextRole !== membership.role;
                        return (
                          <tr key={membership.workspaceId} className="data-row">
                            <td data-primary="true" data-label="Workspace" className="px-5 py-3">
                              <button className="block w-full min-w-0 truncate text-left" title={membership.workspace.name} onClick={() => navigate(`/workspaces/${encodeURIComponent(membership.workspaceId)}`)}>
                                <strong className="block truncate text-sm text-ui-text">{membership.workspace.name}</strong>
                                <span className="mono block break-all text-xs text-ui-text-muted">{membership.workspaceId}</span>
                              </button>
                              <p className="mt-1 text-xs text-ui-text-muted">
                                {formatMembershipLifecycle(membership.createdAt, membership.updatedAt)}
                              </p>
                            </td>
                            <td data-label="Role" className="px-3 py-3 sm:px-5">
                              {canMutate ? (
                                <div className="grid w-full gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                                  <Select
                                    value={nextRole}
                                    onChange={(value) => setRoleDrafts((current) => ({ ...current, [membership.workspaceId]: value }))}
                                    disabled={Boolean(rolePendingWorkspaceId)}
                                    className="min-w-0"
                                    ariaLabel={`Role for ${membership.workspace.name}`}
                                    options={(config?.roleTemplateKeys || []).map((role: string) => ({ value: role, label: titleCase(role) }))}
                                  />
                                  <div className="flex justify-end gap-2 pr-1 md:pr-0">
                                    <Button
                                      size="sm"
                                      className="min-w-0 px-2.5"
                                      disabled={!roleChanged || Boolean(rolePendingWorkspaceId)}
                                      onClick={() => void updateMembershipRole(membership, nextRole)}
                                    >
                                      {rolePendingWorkspaceId === membership.workspaceId ? 'Updating…' : 'Update Role'}
                                    </Button>
                                    <Button
                                      variant="dangerSoft"
                                      size="icon"
                                      className="h-11 w-11 shrink-0 hover:border-control-boundary hover:bg-control-danger hover:text-control-danger-fg sm:h-11 sm:w-11"
                                      aria-label={`Revoke workspace access from ${membership.workspace.name}`}
                                      disabled={Boolean(rolePendingWorkspaceId)}
                                      onClick={() => { setSelected(membership); setDialog('revoke'); }}
                                    >
                                      <UserMinus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : <StatusBadge>{titleCase(membership.role)}</StatusBadge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </DataTableFrame>
              ) : <EmptyState embedded icon={<Users />} title="No Workspace Access" description="This user does not currently have access to a workspace." />}
            </PageSection>
          </>
        )}
      </div>
      {dialog === 'grant' && user && <GrantUserDialog user={user} memberships={memberships} workspaces={workspaces} roles={config.roleTemplateKeys || []} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); void onChanged(); notify('Workspace access successfully granted.'); }} />}
      {dialog === 'revoke' && selected && <UserRevokeDialog user={user} membership={selected} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); void onChanged(); notify(`Access to ${selected.workspace.name} successfully revoked.`); }} />}
    </RightSidePanel>
  );
}

function DetailItem({ term, children }: { term: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="type-label">{term}</dt><dd className="mt-1.5 break-words text-sm text-ui-text">{children}</dd></div>;
}

function GrantUserDialog({ user, memberships, workspaces, roles, onClose, onDone }: any) {
  const available = workspaces.filter((workspace: any) => !memberships.some((membership: any) => membership.workspaceId === workspace.id)).sort((left: any, right: any) => left.name.localeCompare(right.name));
  const [workspaceId, setWorkspaceId] = useState(available[0]?.id || '');
  const [role, setRole] = useState(roles.includes('member') ? 'member' : roles[0] || '');
  const workspace = available.find((item: any) => item.id === workspaceId);
  return <MembershipMutationDialog title={`Grant Workspace Access To ${user.displayName || user.email}`} description="Select a workspace and role. This changes workspace access only." submitLabel="Grant Access" submitDisabled={!workspaceId || !role} request={() => adminApi(`/workspaces/${encodeURIComponent(workspaceId)}/members`, { method: 'POST', body: { userId: user.id, role, createUserIfMissing: false, reason: `Platform admin granted ${titleCase(role)} access to ${workspace?.name || workspaceId}` } })} onClose={onClose} onDone={onDone}>
    <div><FieldLabel>Workspace</FieldLabel><Select value={workspaceId} onChange={setWorkspaceId} options={available.map((item: any) => ({ value: item.id, label: item.name }))} /></div>
    <div><FieldLabel>Workspace Role</FieldLabel><Select value={role} onChange={setRole} options={roles.map((value: string) => ({ value, label: titleCase(value) }))} /></div>
  </MembershipMutationDialog>;
}

function UserRevokeDialog({ user, membership, onClose, onDone }: any) {
  return <MembershipMutationDialog
    title={`Revoke access to ${membership.workspace.name}?`}
    description="Review the affected user and workspace before removing access."
    submitLabel="Revoke Access"
    danger
    request={() => adminApi(`/workspaces/${encodeURIComponent(membership.workspaceId)}/members/${encodeURIComponent(user.id)}`, { method: 'DELETE', body: { reason: 'Platform admin removed workspace membership' } })}
    onClose={onClose}
    onDone={onDone}
  >
    <InlineAlert tone="neutral" className="bg-ui-surface-strong">
      <strong className="block text-ui-text">Workspace access will be removed immediately</strong>
      <span className="mt-1 block">The user keeps their AcornOps account and access to other workspaces.</span>
    </InlineAlert>
    <dl className="grid gap-4 rounded-lg border border-ui-border bg-ui-bg p-4 sm:grid-cols-2">
      <DetailItem term="User">{user.displayName || user.email}</DetailItem>
      <DetailItem term="Workspace">{membership.workspace.name}</DetailItem>
    </dl>
  </MembershipMutationDialog>;
}

function MembershipMutationDialog({ title, description, submitLabel, danger, request, onClose, onDone, children, submitDisabled }: any) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError('');
    try { await request(); onDone(); } catch (reason) { setError(readableError(reason)); setPending(false); }
  };
  return <ActionDialog title={title} description={description} submitLabel={submitLabel} danger={danger} pending={pending} error={error} submitDisabled={submitDisabled} onClose={onClose} onSubmit={submit}>{children}</ActionDialog>;
}
