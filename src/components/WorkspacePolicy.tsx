import { useRef, useState, type FormEvent } from 'react';
import { Button, DataTable, DataTableFrame, DataTableHeaderCell, FieldLabel, HelpText, InlineAlert, Select, TextInput } from '@acornops/ui';
import { adminApi, AdminApiError, readableError } from '../api';
import { ActionDialog } from './ActionDialog';

export const executionPools = [ ['chat', 'Chat'], ['agent', 'Agent'], ['workflow', 'Workflow'], ['autoTriage', 'Auto Triage'], ['insights', 'Insights'] ] as const;
const resourceNames = [['members', 'Members'], ['kubernetesClusters', 'Kubernetes Clusters'], ['virtualMachines', 'Virtual Machines']] as const;
const limitLabel = (value: number | null | undefined) => value === null ? 'Unlimited' : value === undefined ? 'Unavailable' : value.toLocaleString();

type ResourceKey = typeof resourceNames[number][0];
type PoolKey = typeof executionPools[number][0];
type ResourceLimits = Partial<Record<ResourceKey, number | null>>;
type ExecutionLimits = Partial<Record<PoolKey, { maxConcurrentRuns?: number | null; maxOutstandingRuns?: number | null }>>;
interface PreviewPlan {
  key: string;
  name: string;
  limits?: ResourceLimits;
  executionLimits?: ExecutionLimits;
}
interface PreviewPolicy {
  plan: { key: string; name: string };
  effectiveLimits: { quotas?: ResourceLimits; executionLimits?: ExecutionLimits };
  quotaOverrides: ResourceLimits;
  usage: Partial<Record<ResourceKey, number>> & { execution?: Partial<Record<PoolKey, { concurrentRuns?: number; outstandingRuns?: number }>> };
}
interface ImpactRow {
  name: string;
  usage?: number;
  current?: number | null;
  selected?: number | null;
  defaultLimit?: number | null;
  override?: number;
}

function ImpactTable({ rows, caption }: { rows: ImpactRow[]; caption: string }) {
  return <DataTableFrame><DataTable caption={caption} className="min-w-0 table-fixed text-sm">
    <thead><tr>{['Resource', 'Usage', 'Current', 'Selected'].map(label => (
      <DataTableHeaderCell key={label} density="compact" className={label === 'Resource' ? 'w-[34%] px-2 normal-case tracking-normal' : 'w-[22%] px-2 normal-case tracking-normal'}>
        {label}
      </DataTableHeaderCell>
    ))}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.name} className="border-t border-ui-border">
      <th scope="row" className="break-words px-2 py-3 align-top text-left font-medium">{row.name}</th>
      <td data-label="Usage" className="px-2 py-3 align-top tabular-nums">{row.usage === undefined ? 'Unavailable' : row.usage.toLocaleString()}</td>
      <td data-label="Current" className="px-2 py-3 align-top tabular-nums">{limitLabel(row.current)}</td>
      <td data-label="Selected" className="break-words px-2 py-3 align-top tabular-nums">
        <div className="min-w-0">
          {limitLabel(row.selected)}
          {row.override !== undefined && <span className="mt-1 block text-ui-text-muted">Default: {limitLabel(row.defaultLimit)}<br />Override kept</span>}
          {typeof row.selected === 'number' && row.usage !== undefined && row.usage > row.selected && <span className="mt-1 block text-status-danger-text">Above selected limit</span>}
        </div>
      </td>
    </tr>)}</tbody>
  </DataTable></DataTableFrame>;
}

function PlanImpactPreview({ policy, selectedPlan }: { policy: PreviewPolicy; selectedPlan?: PreviewPlan }) {
  if (!selectedPlan) return <HelpText>Selected plan limits are unavailable. Refresh workspace details before changing plans.</HelpText>;
  const resources: ImpactRow[] = resourceNames.map(([key, name]) => {
    // The producer treats null overrides as plan defaults, not unlimited overrides.
    const override = policy.quotaOverrides[key] ?? undefined;
    const defaultLimit = selectedPlan.limits?.[key];
    return {
      name, usage: policy.usage[key], current: policy.effectiveLimits.quotas?.[key],
      selected: override ?? defaultLimit, defaultLimit, override
    };
  });
  const execution: ImpactRow[] = executionPools.flatMap(([key, name]) => [
    { name: `${name} Concurrent`, usage: policy.usage.execution?.[key]?.concurrentRuns, current: policy.effectiveLimits.executionLimits?.[key]?.maxConcurrentRuns, selected: selectedPlan.executionLimits?.[key]?.maxConcurrentRuns },
    { name: `${name} Outstanding`, usage: policy.usage.execution?.[key]?.outstandingRuns, current: policy.effectiveLimits.executionLimits?.[key]?.maxOutstandingRuns, selected: selectedPlan.executionLimits?.[key]?.maxOutstandingRuns }
  ]);
  const exceedsSelected = [...resources, ...execution].some(row => typeof row.selected === 'number' && row.usage !== undefined && row.usage > row.selected);
  return <section aria-label="Plan impact preview" className="space-y-3">
    <div><h3 className="type-row-title">Plan Impact Preview</h3><HelpText>Current: {policy.plan.name}. Selected: {selectedPlan.name}.</HelpText></div>
    {selectedPlan.key === policy.plan.key && <HelpText>Current plan selected. No plan change.</HelpText>}
    <ImpactTable rows={resources} caption="Resource usage and current versus selected limits" />
    <details>
      <summary className="cursor-pointer rounded-md py-2 type-row-title focus-visible:outline focus-visible:outline-2 focus-visible:outline-control-boundary">Execution Pools</summary>
      <HelpText>Concurrent and outstanding limits apply independently to each pool.</HelpText>
      <ImpactTable rows={execution} caption="Execution usage and current versus selected limits" />
    </details>
    {exceedsSelected && <InlineAlert tone="warning">Recorded usage exceeds selected limits. The server checks current usage before applying a change.</InlineAlert>}
    <HelpText>Selected limits use plan defaults unless an override is kept. Overrides remain read-only. Unlimited means no cap; unavailable values are not zero. This snapshot does not replace server validation.</HelpText>
  </section>;
}

export function WorkspacePolicySummary({ policy }: { policy: any }) {
  return <section className="px-4 py-3 sm:px-5" aria-label="Effective workspace policy">
    <h2 className="type-panel-title">Effective Limits And Usage</h2>
    <p className="mt-1 text-sm text-ui-text-muted">Current plan: {policy.plan.name} ({policy.plan.key}). Policy version {policy.policyVersion}. Overrides are read-only and remain in place when changing plans.</p>
    <dl className="mt-3 space-y-2 text-sm">
      {resourceNames.map(([key, name]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{name}</dt><dd>{policy.usage[key]} / {limitLabel(policy.effectiveLimits.quotas[key])}{policy.quotaOverrides[key] != null ? ` · Override: ${policy.quotaOverrides[key]}` : ' · Plan default'}</dd></div>)}
    </dl>
    <h3 className="mt-4 type-row-title">Execution Pools</h3>
    <p className="text-sm text-ui-text-muted">Each pool has independent concurrent and outstanding limits.</p>
    <dl className="mt-2 space-y-3 text-sm">{executionPools.map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt><dd className="text-ui-text-muted">Concurrent: {policy.usage.execution[key].concurrentRuns} / {limitLabel(policy.effectiveLimits.executionLimits[key].maxConcurrentRuns)} · Outstanding: {policy.usage.execution[key].outstandingRuns} / {limitLabel(policy.effectiveLimits.executionLimits[key].maxOutstandingRuns)}</dd></div>)}</dl>
    <h3 className="mt-4 type-row-title">Suspension Holds</h3>
    {policy.holds.length ? <ul className="mt-2 space-y-2 text-sm">{policy.holds.map((hold: any) => <li key={hold.source}><strong>{hold.source === 'admin' ? 'Admin hold' : 'External hold'}</strong>{hold.publicReason ? ` · ${hold.publicReason}` : ''}</li>)}</ul> : <p className="mt-2 text-sm text-ui-text-muted">No active holds.</p>}
  </section>;
}

/** A retry reuses the exact intent; conflicts require another deliberate submission. */
export function WorkspacePolicyDialog({ workspace: initialWorkspace, policy: initialPolicy, plans, action, onClose, onDone }: any) {
  const [policy, setPolicy] = useState(initialPolicy);
  const workspace = { ...initialWorkspace, name: policy.workspaceName || initialWorkspace.name };
  const [showFreshPolicy, setShowFreshPolicy] = useState(false);
  const [planKey, setPlanKey] = useState(initialPolicy.plan.key);
  const [confirmation, setConfirmation] = useState('');
  const [overLimit, setOverLimit] = useState(false);
  const [retainExisting, setRetainExisting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [policyStale, setPolicyStale] = useState(false);
  const intent = useRef<{ key: string; body: any } | null>(null);
  const restoring = action === 'restore';
  const isPlan = action === 'plan';
  const selectedPlan = plans.find((plan: PreviewPlan) => plan.key === planKey);
  const submitDisabled = policyStale || (isPlan ? !selectedPlan || planKey === policy.plan.key || (overLimit && !retainExisting) : confirmation !== workspace.name);
  const refreshPolicy = async () => {
    setPending(true);
    try {
      setPolicy(await adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/policy`));
      setPolicyStale(false);
      setConfirmation('');
      setOverLimit(false);
      setRetainExisting(false);
      setShowFreshPolicy(true);
      setError('Policy changed. Review the latest state and submit a new confirmation.');
    } catch (refreshError) { setError(readableError(refreshError)); }
    finally { setPending(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || submitDisabled) return;
    setPending(true); setError('');
    const fields = { expectedPolicyVersion: policy.policyVersion, ...(isPlan ? { planKey, overLimitBehavior: retainExisting ? 'retain_existing' : 'reject', reason: `Platform admin changed workspace plan from ${policy.plan.key} to ${planKey}` } : { workspaceName: confirmation, source: 'admin', reason: `Platform admin ${restoring ? 'restored' : 'suspended'} workspace member access` }) };
    const key = JSON.stringify(fields);
    if (intent.current?.key !== key) intent.current = { key, body: { ...fields, requestId: crypto.randomUUID() } };
    try {
      const result = await adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/${action}`, { method: isPlan ? 'PATCH' : 'POST', body: intent.current.body });
      onDone(result);
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.code === 'WORKSPACE_POLICY_VERSION_CONFLICT') {
        intent.current = null;
        setPolicyStale(true); setOverLimit(false); setRetainExisting(false);
        await refreshPolicy();
      } else if (reason instanceof AdminApiError && reason.code === 'VALIDATION_ERROR' && /usage exceeds/.test(reason.message)) {
        setOverLimit(true); setError('Usage exceeds this plan. Confirm retaining existing resources and letting active work drain to continue.');
      } else setError(readableError(reason));
    } finally { setPending(false); }
  };
  return <ActionDialog
    title={isPlan ? `Change ${workspace.name} Plan` : `${restoring ? 'Restore' : 'Suspend'} ${workspace.name}`}
    description={isPlan ? 'Updates effective limits while preserving explicit overrides and existing resources.' : restoring ? 'Removes only the admin hold. An external hold can keep this workspace suspended.' : 'Blocks member access, cancels queued work and requests controlled cancellation of running work. Resources and memberships are retained.'}
    submitLabel={isPlan ? 'Update Plan' : `${restoring ? 'Restore' : 'Suspend'} Workspace`}
    danger={!isPlan && !restoring}
    pending={pending}
    error={error}
    onClose={onClose}
    onSubmit={submit}
    submitDisabled={submitDisabled}
  >
    {showFreshPolicy && !isPlan && <WorkspacePolicySummary policy={policy} />}
    <HelpText>Policy version {policy.policyVersion}. {policy.holds.some((hold: any) => hold.source === 'external') ? 'An external hold is active.' : ''}</HelpText>
    {policyStale && <div>
      <HelpText>Policy is stale. Refresh before submitting another change.</HelpText>
      <Button variant="secondary" disabled={pending} onClick={() => void refreshPolicy()}>Refresh Policy</Button>
    </div>}
    {isPlan ? <>
      <div>
        <FieldLabel htmlFor="workspace-plan">Plan</FieldLabel>
        <Select id="workspace-plan" ariaLabel="Plan" value={planKey} disabled={pending}
          onChange={(value) => { setPlanKey(value); setOverLimit(false); setRetainExisting(false); }}
          options={plans.map((plan: PreviewPlan) => ({ value: plan.key, label: plan.name }))}
        />
      </div>
      <PlanImpactPreview policy={policy} selectedPlan={selectedPlan} />
      {overLimit && <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={retainExisting} disabled={pending} onChange={event => setRetainExisting(event.target.checked)} />
        Retain existing resources and let active work drain under the new limits.
      </label>}
    </> : <>
      <FieldLabel htmlFor="workspace-confirmation" className="text-sm font-normal leading-5 normal-case tracking-normal">Type <strong className="font-semibold">{workspace.name}</strong> to confirm</FieldLabel>
      <TextInput id="workspace-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" aria-describedby="workspace-confirmation-help" />
      <HelpText id="workspace-confirmation-help">The name must match exactly.</HelpText>
    </>}
  </ActionDialog>;
}
