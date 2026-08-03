import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Search, UserMinus, UserRoundPlus, Users } from 'lucide-react';
import {
  Button,
  CloseButton,
  DataSurface,
  DataTable,
  DataTableFrame,
  DataTableHeaderCell,
  EmptyState,
  FieldLabel,
  HelpText,
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
import { formatDate, sortMembers, titleCase, workspaceCreatorName } from '../lib';
import { ActionDialog } from '../components/ActionDialog';

const pageLimit = 25;

export function WorkspacesPage(props: PageProps) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [totalWorkspaceCount, setTotalWorkspaceCount] = useState(0);

  const load = useCallback(async (append = false) => {
    setLoading(true);
    setError('');
    try {
      if (status !== 'all') {
        const all = await loadAllPages<any>(`/workspaces${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
        setItems(all.filter((workspace) => workspace.lifecycleStatus === status));
        setNextCursor('');
      } else {
        const params = new URLSearchParams({ limit: String(pageLimit) });
        if (query.trim()) params.set('q', query.trim());
        if (append && nextCursor) params.set('cursor', nextCursor);
        const page = await adminApi<{ items: any[]; nextCursor?: string }>(`/workspaces?${params}`);
        setItems((current) => append ? [...current, ...page.items.filter((item) => !current.some((known) => known.id === item.id))] : page.items);
        setNextCursor(page.nextCursor || '');
      }
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setLoading(false);
    }
  }, [nextCursor, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(false), 240);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);
  useEffect(() => {
    let active = true;
    void loadAllPages<any>('/workspaces')
      .then((workspaces) => { if (active) setTotalWorkspaceCount(workspaces.length); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const selectedId = props.resourceId;
  const closePanel = () => props.navigate('/workspaces', { replace: true });
  const refresh = () => void load(false);

  return (
    <>
      <PageHeader title="Workspaces" description="Review workspace governance, plans, access, and creation details." />
      <DataSurface
        toolbarFullWidth
        toolbar={
          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
            <label className="relative min-w-0">
              <span className="sr-only">Search workspaces by name</span>
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ui-text-muted" aria-hidden="true" />
              <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace name" className="pl-10" />
            </label>
            <Select value={status} onChange={setStatus} ariaLabel="Filter workspaces by status" className="min-w-0" options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' }
            ]} />
            <StatusBadge className="h-11 justify-center whitespace-nowrap px-4 tabular-nums">
              Showing {items.length} of {Math.max(totalWorkspaceCount, items.length)}
            </StatusBadge>
          </div>
        }
      >
        {loading && !items.length ? <LoadingState label="Loading workspaces" /> : error && !items.length ? (
          <div className="p-5"><InlineAlert tone="danger">{error}</InlineAlert></div>
        ) : items.length ? (
          <>
            <DataTableFrame>
              <DataTable caption="Workspaces">
                <thead><tr>
                  <DataTableHeaderCell density="compact">Workspace</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Created By</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Members</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Status</DataTableHeaderCell>
                  <DataTableHeaderCell density="compact">Created</DataTableHeaderCell>
                </tr></thead>
                <tbody>
                  {items.map((workspace) => (
                    <tr
                      key={workspace.id}
                      className="data-row cursor-pointer"
                      aria-selected={selectedId === workspace.id}
                      tabIndex={0}
                      onClick={() => props.navigate(`/workspaces/${encodeURIComponent(workspace.id)}`)}
                      onKeyDown={(event) => { if (event.key === 'Enter') props.navigate(`/workspaces/${encodeURIComponent(workspace.id)}`); }}
                    >
                      <td data-primary="true" data-label="Workspace" className="px-5 py-4"><strong className="block text-sm text-ui-text">{workspace.name}</strong><span className="mono block text-xs text-ui-text-muted">{workspace.id}</span></td>
                      <td data-label="Created By" className="px-5 py-4 text-sm text-ui-text">{workspaceCreatorName(workspace)}</td>
                      <td data-label="Members" className="px-5 py-4 text-sm tabular-nums text-ui-text">{Number(workspace.memberCount).toLocaleString()}</td>
                      <td data-label="Status" className="px-5 py-4">
                        <StatusBadge tone={workspace.lifecycleStatus === 'suspended' ? 'warning' : 'success'} className="gap-1.5">
                          {workspace.lifecycleStatus !== 'suspended' && <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden="true" />}
                          {workspace.lifecycleStatus === 'suspended' ? 'Suspended' : 'Active'}
                        </StatusBadge>
                      </td>
                      <td data-label="Created" className="px-5 py-4 text-sm text-ui-text-muted">{formatDate(workspace.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableFrame>
            {nextCursor && <div className="flex justify-center border-t border-ui-border p-4"><Button onClick={() => void load(true)} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</Button></div>}
          </>
        ) : (
          <EmptyState embedded icon={<Users />} title="No Workspaces Found" description="No workspaces match this search or filter." />
        )}
      </DataSurface>
      {selectedId && <WorkspacePanel {...props} workspaceId={selectedId} onClose={closePanel} onChanged={refresh} />}
    </>
  );
}

function WorkspacePanel({ workspaceId, onClose, onChanged, canMutate, navigate, notify }: PageProps & {
  workspaceId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [workspace, setWorkspace] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [dialog, setDialog] = useState<'plan' | 'lifecycle' | 'grant' | 'revoke' | null>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [managing, setManaging] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [rolePendingUserId, setRolePendingUserId] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      const [detail, systemConfig, memberItems, allUsers] = await Promise.all([
        adminApi(`/workspaces/${encodeURIComponent(workspaceId)}`),
        adminApi('/system/config'),
        loadAllPages(`/workspaces/${encodeURIComponent(workspaceId)}/members`),
        loadAllPages('/users')
      ]);
      setWorkspace(detail);
      setConfig(systemConfig);
      const sortedMembers = sortMembers(memberItems);
      setMembers(sortedMembers);
      setRoleDrafts(Object.fromEntries(sortedMembers.map((member: any) => [member.userId, member.role])));
      setUsers(allUsers);
    } catch (reason) {
      setError(readableError(reason));
    }
  }, [workspaceId]);

  useEffect(() => { void reload(); }, [reload]);
  const titleId = 'workspace-panel-title';
  const plans = config?.planCatalog?.plans || [];
  const plan = plans.find((item: any) => item.key === workspace?.plan?.key);
  const ownerCount = members.filter((member) => member.role === 'owner').length;
  const updateMemberRole = async (member: any, nextRole: string) => {
    setAccessError('');
    setRolePendingUserId(member.userId);
    try {
      await adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/members/${encodeURIComponent(member.userId)}/role`, {
        method: 'PATCH',
        body: {
          role: nextRole,
          reason: `Platform admin changed workspace role from ${titleCase(member.role)} to ${titleCase(nextRole)}`
        }
      });
      await reload();
      notify(`Role successfully updated to ${titleCase(nextRole)}.`);
    } catch (reason) {
      setAccessError(readableError(reason));
    } finally {
      setRolePendingUserId('');
    }
  };

  return (
    <RightSidePanel isOpen onClose={onClose} titleId={titleId}>
      <header className="flex items-start justify-between gap-3 border-b border-ui-border bg-ui-bg px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-lg font-semibold text-ui-text">{workspace?.name || 'Workspace Details'}</h2>
          <p className="mono truncate text-xs text-ui-text-muted">{workspace?.id || workspaceId}</p>
        </div>
        <CloseButton aria-label="Close workspace details" onClick={onClose} />
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {!workspace && !error ? <LoadingState label="Loading workspace details" /> : error ? <div className="p-4 sm:p-6"><InlineAlert tone="danger">{error}</InlineAlert></div> : (
          <>
            <section className="px-4 py-3 sm:px-5">
              <h2 className="type-panel-title">Workspace Details</h2>
              <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem term="Kubernetes Clusters">
                  <span className="inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-bg px-3 type-row-title tabular-nums">
                    {Number(workspace.clusterCount).toLocaleString()} / {plan?.quotas?.kubernetesClusters ?? '—'}
                  </span>
                </DetailItem>
                <DetailItem term="Virtual Machines">
                  <span className="inline-flex min-h-8 items-center rounded-md border border-ui-border bg-ui-bg px-3 type-row-title tabular-nums">
                    {Number(workspace.virtualMachineCount).toLocaleString()} / {plan?.quotas?.virtualMachines ?? '—'}
                  </span>
                </DetailItem>
                <DetailItem term="Current Plan">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-row-title">{workspace.plan?.name}</span>
                    {canMutate && <Button size="sm" className="sm:min-h-8 sm:px-2.5" onClick={() => setDialog('plan')}>Change Plan</Button>}
                  </span>
                </DetailItem>
                <DetailItem term="Created By">{workspaceCreatorName(workspace)}</DetailItem>
                <DetailItem term="Created">{formatDate(workspace.createdAt)}</DetailItem>
              </dl>
            </section>
            <PageSection
              compact
              title={(
                <span className="flex flex-wrap items-center gap-2">
                  Workspace Access
                  <StatusBadge className="rounded-md px-2.5 py-1 tabular-nums">
                    {members.length} member{members.length === 1 ? '' : 's'}
                  </StatusBadge>
                </span>
              )}
              description="Members and roles currently assigned to this workspace."
              className="!mt-0 px-4 py-3 sm:px-5"
              actions={canMutate && <div className="flex gap-2"><Button size="sm" onClick={() => setManaging((current) => !current)}>{managing ? 'Done' : 'Manage Access'}</Button>{managing && <Button variant="icon" size="icon" aria-label="Add workspace access" onClick={() => setDialog('grant')}><UserRoundPlus className="h-4 w-4" /></Button>}</div>}
            >
              {accessError && <InlineAlert tone="danger" className="mb-3">{accessError}</InlineAlert>}
              {members.length ? (
                <DataTableFrame className="-mx-4 border-t border-ui-border sm:-mx-5">
                  <DataTable caption={`Members with access to ${workspace.name}`} className="min-w-[40rem] table-fixed">
                    <thead><tr>
                      <DataTableHeaderCell density="compact" className="w-[25%] font-medium">User</DataTableHeaderCell>
                      <DataTableHeaderCell density="compact" className="w-[29%] font-medium">Email</DataTableHeaderCell>
                      <DataTableHeaderCell density="compact" className="w-[46%] font-medium">Role</DataTableHeaderCell>
                    </tr></thead>
                    <tbody className="border-t border-ui-border">
                      {members.map((member) => {
                        const isSoleOwner = member.role === 'owner' && ownerCount === 1;
                        const nextRole = roleDrafts[member.userId] ?? member.role;
                        const roleChanged = nextRole !== member.role;
                        return (
                          <tr key={member.userId} className="data-row">
                            <td data-primary="true" data-label="User" className="px-5 py-3">
                              <button className="block w-full min-w-0 truncate text-left" title={member.displayName || member.email} onClick={() => navigate(`/users/${encodeURIComponent(member.userId)}?workspace=${encodeURIComponent(workspace.name)}`)}>
                                <strong className="block truncate text-sm text-ui-text">{member.displayName || member.email}</strong>
                              </button>
                            </td>
                            <td data-label="Email" className="break-words px-5 py-3 text-sm text-ui-text">{member.email}</td>
                            <td data-label="Role" className="px-3 py-3 sm:px-5">
                              {managing ? (
                                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[8rem_auto_auto]">
                                  <Select
                                    value={nextRole}
                                    onChange={(value) => setRoleDrafts((current) => ({ ...current, [member.userId]: value }))}
                                    disabled={isSoleOwner || Boolean(rolePendingUserId)}
                                    className="col-span-2 min-w-0 sm:col-span-1"
                                    ariaLabel={`Role for ${member.displayName || member.email}`}
                                    options={(config.roleTemplateKeys || []).map((role: string) => ({ value: role, label: titleCase(role) }))}
                                  />
                                  <Button
                                    size="sm"
                                    className="min-w-0 sm:min-w-[6.5rem]"
                                    disabled={isSoleOwner || !roleChanged || Boolean(rolePendingUserId)}
                                    onClick={() => void updateMemberRole(member, nextRole)}
                                  >
                                    {rolePendingUserId === member.userId ? 'Updating…' : 'Update Role'}
                                  </Button>
                                  <Button variant="dangerSoft" size="icon" className="h-11 w-11 shrink-0 hover:border-control-boundary hover:bg-control-danger hover:text-control-danger-fg sm:h-11 sm:w-11" aria-label={`Revoke workspace access from ${member.displayName || member.email}`} disabled={isSoleOwner || Boolean(rolePendingUserId)} onClick={() => { setSelectedMember({ ...member, isSoleOwner }); setDialog('revoke'); }}>
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : <StatusBadge>{titleCase(member.role)}</StatusBadge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </DataTableFrame>
              ) : <EmptyState embedded icon={<Users />} title="No Workspace Access" description="Choose Manage Access to grant an existing user access." />}
            </PageSection>
            <PageSection
              compact
              title="Workspace Lifecycle"
              description={workspace.lifecycleStatus === 'suspended' ? 'Restore member access using the retained workspace memberships.' : 'Suspend member access while retaining memberships, targets, workloads, references, and audit history.'}
              className="!mt-0 px-4 py-3 sm:px-5"
              actions={<StatusBadge tone={workspace.lifecycleStatus === 'suspended' ? 'warning' : 'success'} className="gap-1.5">
                {workspace.lifecycleStatus !== 'suspended' && <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden="true" />}
                {titleCase(workspace.lifecycleStatus || 'active')}
              </StatusBadge>}
            >
              <HelpText>This action does not stop or modify workloads.</HelpText>
              {canMutate && <Button className="mt-3 w-full" variant={workspace.lifecycleStatus === 'suspended' ? 'secondary' : 'dangerSoft'} onClick={() => setDialog('lifecycle')}>{workspace.lifecycleStatus === 'suspended' ? 'Restore Workspace' : 'Suspend Workspace'}</Button>}
            </PageSection>
          </>
        )}
      </div>
      {dialog === 'plan' && <PlanDialog workspace={workspace} plans={plans} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); onChanged(); notify('Plan successfully updated.'); }} />}
      {dialog === 'lifecycle' && <LifecycleDialog workspace={workspace} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); onChanged(); notify(`Workspace successfully ${workspace.lifecycleStatus === 'suspended' ? 'restored' : 'suspended'}.`); }} />}
      {dialog === 'grant' && <GrantDialog workspace={workspace} members={members} users={users} roles={config.roleTemplateKeys || []} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); onChanged(); notify('Workspace access successfully granted.'); }} />}
      {dialog === 'revoke' && selectedMember && <RevokeDialog workspace={workspace} member={selectedMember} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); onChanged(); notify('Workspace access successfully revoked.'); }} />}
    </RightSidePanel>
  );
}

function DetailItem({ term, children }: { term: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="type-label">{term}</dt><dd className="mt-1.5 break-words text-sm text-ui-text">{children}</dd></div>;
}

function PlanDialog({ workspace, plans, onClose, onDone }: any) {
  const [planKey, setPlanKey] = useState(workspace.plan.key);
  return <MutationDialog title={`Change ${workspace.name} Plan`} description="Updates the plan and configured limits without modifying tenant workloads." submitLabel="Update Plan" onClose={onClose} onDone={onDone} request={() => adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/plan`, { method: 'PATCH', body: { planKey, reason: `Platform admin changed workspace plan from ${workspace.plan.key} to ${planKey}` } })} submitDisabled={planKey === workspace.plan.key}>
    <FieldLabel>Plan</FieldLabel><Select value={planKey} onChange={setPlanKey} options={plans.map((plan: any) => ({ value: plan.key, label: plan.name }))} />
  </MutationDialog>;
}

function LifecycleDialog({ workspace, onClose, onDone }: any) {
  const [confirmation, setConfirmation] = useState('');
  const restoring = workspace.lifecycleStatus === 'suspended';
  return <MutationDialog title={`${restoring ? 'Restore' : 'Suspend'} ${workspace.name}`} description={restoring ? 'Restores member access through retained memberships.' : 'Blocks member access while retaining memberships, targets, workloads, references, and audit history.'} submitLabel={`${restoring ? 'Restore' : 'Suspend'} Workspace`} danger={!restoring} onClose={onClose} onDone={onDone} request={() => adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/${restoring ? 'restore' : 'suspend'}`, { method: 'POST', body: { workspaceName: confirmation, reason: `Platform admin ${restoring ? 'restored' : 'suspended'} workspace member access` } })} submitDisabled={confirmation !== workspace.name}>
    <FieldLabel htmlFor="workspace-confirmation" className="text-sm font-normal leading-5 normal-case tracking-normal">
      Type <strong className="font-semibold">{workspace.name}</strong> to confirm
    </FieldLabel>
    <TextInput id="workspace-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
    <HelpText>The name must match exactly. This action does not change workloads.</HelpText>
  </MutationDialog>;
}

function GrantDialog({ workspace, members, users, roles, onClose, onDone }: any) {
  const available = users.filter((user: any) => !members.some((member: any) => member.userId === user.id)).sort((a: any, b: any) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email)));
  const [userId, setUserId] = useState(available[0]?.id || '');
  const [role, setRole] = useState(roles.includes('member') ? 'member' : roles[0] || '');
  return <MutationDialog title={`Grant Access To ${workspace.name}`} description="Select an existing user and workspace role." submitLabel="Grant Access" onClose={onClose} onDone={onDone} request={() => adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/members`, { method: 'POST', body: { userId, role, createUserIfMissing: false, reason: `Platform admin granted ${titleCase(role)} access to ${workspace.name}` } })} submitDisabled={!userId || !role}>
    <div><FieldLabel>User</FieldLabel><Select value={userId} onChange={setUserId} options={available.map((user: any) => ({ value: user.id, label: user.displayName || user.email }))} /></div>
    <div><FieldLabel>Workspace Role</FieldLabel><Select value={role} onChange={setRole} options={roles.map((value: string) => ({ value, label: titleCase(value) }))} /></div>
  </MutationDialog>;
}

function RevokeDialog({ workspace, member, onClose, onDone }: any) {
  return <MutationDialog title={`Revoke access to ${workspace.name}?`} description="Review the affected user and workspace before removing access." submitLabel="Revoke Access" danger onClose={onClose} onDone={onDone} request={() => adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/members/${encodeURIComponent(member.userId)}`, { method: 'DELETE', body: { reason: 'Platform admin removed workspace membership' } })}>
    <InlineAlert tone="neutral" className="bg-ui-surface-strong">
      <strong className="block text-ui-text">Workspace access will be removed immediately</strong>
      <span className="mt-1 block">The user keeps their AcornOps account and access to other workspaces.</span>
    </InlineAlert>
    <dl className="grid gap-4 rounded-lg border border-ui-border bg-ui-bg p-4 sm:grid-cols-2">
      <DetailItem term="User">{member.displayName || member.email}</DetailItem>
      <DetailItem term="Workspace">{workspace.name}</DetailItem>
    </dl>
  </MutationDialog>;
}

function MutationDialog({ title, description, submitLabel, danger, submitDisabled, request, onClose, onDone, children }: any) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError('');
    try { await request(); onDone(); } catch (reason) { setError(readableError(reason)); setPending(false); }
  };
  return <ActionDialog title={title} description={description} submitLabel={submitLabel} danger={danger} submitDisabled={submitDisabled} pending={pending} error={error} onClose={onClose} onSubmit={submit}>{children}</ActionDialog>;
}
