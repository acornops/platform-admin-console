import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, PanelsTopLeft, Server, Users } from 'lucide-react';
import { Button, InlineAlert, LoadingState, PageHeader } from '@acornops/ui';
import { loadAllPages, readableError } from '../api';
import type { PageProps } from '../app-types';

export function buildOverviewModel({ workspaces, users }: { workspaces: any[]; users: any[] }) {
  const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const percent = (value: number, total: number) => total ? Math.round((value / total) * 100) : 0;
  const kubernetesCount = workspaces.reduce((sum, item) => sum + number(item.clusterCount), 0);
  const virtualMachineCount = workspaces.reduce((sum, item) => sum + number(item.virtualMachineCount), 0);
  const environmentCount = kubernetesCount + virtualMachineCount;
  const environmentLeaders = workspaces.map((item) => ({
    id: item.id,
    name: item.name,
    clusterCount: number(item.clusterCount),
    virtualMachineCount: number(item.virtualMachineCount),
    environmentCount: number(item.clusterCount) + number(item.virtualMachineCount)
  })).sort((left, right) => right.environmentCount - left.environmentCount || left.name.localeCompare(right.name)).slice(0, 3);
  const verifiedUserCount = users.filter((user) => user.emailVerified).length;
  return {
    workspaceCount: workspaces.length,
    userCount: users.length,
    kubernetesCount,
    virtualMachineCount,
    environmentCount,
    environmentLeaders,
    topEnvironmentShare: percent(environmentLeaders[0]?.environmentCount || 0, environmentCount),
    suspendedWorkspaceCount: workspaces.filter((workspace) => workspace.lifecycleStatus === 'suspended').length,
    verifiedPercent: percent(verifiedUserCount, users.length),
    unverifiedUserCount: users.length - verifiedUserCount
  };
}

export function OverviewPage({ navigate }: PageProps) {
  const [data, setData] = useState<{ workspaces: any[]; users: any[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([loadAllPages('/workspaces'), loadAllPages('/users')])
      .then(([workspaces, users]) => setData({ workspaces, users }))
      .catch((reason) => setError(readableError(reason)));
  }, []);

  if (!data && !error) return <><PageHeader title="Platform Insights" description="A governance-safe view of platform adoption, access, and portfolio health." /><section className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface"><LoadingState label="Loading platform insights" /></section></>;
  if (error) return <><PageHeader title="Unable To Open Platform Insights" description="The governance service did not return a usable response." /><InlineAlert tone="danger">{error}</InlineAlert></>;

  const model = buildOverviewModel(data!);
  const metrics = [
    { label: 'Workspaces', value: model.workspaceCount, detail: 'Active platform customers and internal teams', icon: PanelsTopLeft },
    { label: 'Users', value: model.userCount, detail: `${model.verifiedPercent}% identity verification`, icon: Users },
    { label: 'Connected Environments', value: model.environmentCount, detail: `${model.kubernetesCount} Kubernetes · ${model.virtualMachineCount} VMs`, icon: Server }
  ];

  return (
    <>
      <PageHeader title="Platform Insights" description="A governance-safe view of platform adoption, access, and portfolio health." />
      <section className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
        <div className="border-b border-ui-border px-5 py-4 sm:px-6">
          <h2 className="type-row-title">Platform Footprint</h2>
          <p className="type-caption mt-1">Current totals across the complete governance catalog.</p>
        </div>
        <div className="grid divide-y divide-ui-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {metrics.map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="flex min-w-0 items-center gap-4 px-5 py-4 sm:px-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center self-center rounded-xl border border-[rgb(var(--admin-clay)/0.24)] bg-[rgb(var(--admin-clay-soft))] text-[rgb(var(--admin-clay-strong))]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <dl className="min-w-0">
                <dt className="type-row-title">{label}</dt>
                <dd className="type-data mt-1">{value}</dd>
                <dd className="type-caption mt-1">{detail}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2 xl:items-stretch">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
          <div className="flex flex-col gap-3 border-b border-ui-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 xl:min-h-[4.75rem]">
            <div className="min-w-0">
              <h2 className="type-row-title">Most Connected Environments</h2>
              <p className="type-caption mt-1">Workspaces with the largest connected footprint.</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              <Button variant="tertiary" size="sm" className="sm:min-h-11" onClick={() => navigate('/workspaces')}>Explore workspaces <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="xl:flex-1">
            {model.environmentLeaders.length ? (
              <ol className="xl:flex xl:h-full xl:flex-col xl:justify-start">
                {model.environmentLeaders.map((workspace, index) => (
                  <li
                    key={workspace.id}
                    className={`data-row flex items-center gap-4 px-5 py-4 ${model.environmentLeaders.length === 3 ? 'xl:flex-1' : ''}`}
                  >
                    <span className="type-caption grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ui-surface-strong">{index + 1}</span>
                    <button className="type-row-title min-w-0 flex-1 truncate text-left hover:text-accent-readable" onClick={() => navigate(`/workspaces/${encodeURIComponent(workspace.id)}`)}>{workspace.name}</button>
                    <strong className="type-caption text-right">{workspace.environmentCount} total ({workspace.clusterCount} clusters · {workspace.virtualMachineCount} VMs)</strong>
                  </li>
                ))}
              </ol>
            ) : <div className="p-5 text-sm text-ui-text-muted">No workspace data is available.</div>}
          </div>
        </section>
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
          <div className="border-b border-ui-border px-5 py-4 sm:px-6 xl:min-h-[4.75rem]">
            <h2 className="type-row-title">Product Signals</h2>
            <p className="type-caption mt-1">Portfolio conditions that may need administrator attention.</p>
          </div>
          <div className="divide-y divide-ui-border xl:flex xl:flex-1 xl:flex-col">
            {[
              {
                value: model.suspendedWorkspaceCount,
                title: `${model.suspendedWorkspaceCount} Suspended workspace${model.suspendedWorkspaceCount === 1 ? '' : 's'}`,
                detail: model.suspendedWorkspaceCount ? `${model.suspendedWorkspaceCount} of ${model.workspaceCount} workspaces have suspended member access.` : `All ${model.workspaceCount} workspaces are available to members.`,
                path: '/workspaces'
              },
              {
                value: model.unverifiedUserCount,
                title: model.unverifiedUserCount ? 'Identity verification needs follow-up' : 'All identities are verified',
                detail: model.unverifiedUserCount ? `${model.unverifiedUserCount} user accounts remain unverified.` : 'Every current user account has completed verification.',
                path: '/users'
              },
              {
                value: `${model.topEnvironmentShare}%`,
                title: `Most connected environments are in ${model.environmentLeaders[0]?.name || 'No Workspace'}`,
                detail: model.environmentLeaders[0] ? `${model.environmentLeaders[0].name} accounts for ${model.topEnvironmentShare}% of all connected environments.` : 'Concentration appears when workspaces are available.'
              }
            ].map((signal) => (
              <article key={signal.title} className="flex gap-4 px-5 py-4 sm:px-6 xl:flex-1">
                <span className="type-caption grid h-9 w-12 shrink-0 place-items-center rounded-md border border-ui-border bg-ui-bg font-semibold tabular-nums text-ui-text">{signal.value}</span>
                <div className="min-w-0">
                  <h3 className="type-row-title">{signal.title}</h3>
                  <p className="type-caption mt-1">{signal.detail} {signal.path && <button className="font-semibold text-accent-readable hover:underline" onClick={() => navigate(signal.path!)}>Review →</button>}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside
        aria-label="Data boundary"
        className="mt-4 flex items-center gap-2 rounded-md bg-ui-surface-strong px-3.5 py-3 text-[11px] leading-[17px] text-ui-text-muted max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)]"
      >
        <LockKeyhole className="h-4 w-4 shrink-0 text-[rgb(var(--admin-clay))] max-sm:row-span-2" aria-hidden="true" />
        <strong className="shrink-0 text-ui-text">Governance data only.</strong>
        <span>No workspace logs or tenant audit events. No targets, agents, sessions, runs, prompts, commands, tools, workspace credentials, or workload changes.</span>
      </aside>
    </>
  );
}
