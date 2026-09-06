import { useRef, useState, type FormEvent } from 'react';
import { FieldLabel, HelpText, Select, TextInput } from '@acornops/ui';
import { adminApi, AdminApiError, readableError } from '../api';
import { ActionDialog } from './ActionDialog';

export const executionPools = [ ['chat', 'Chat'], ['agent', 'Agent'], ['workflow', 'Workflow'], ['autoTriage', 'Auto Triage'], ['insights', 'Insights'] ] as const;
const resourceNames = [['members', 'Members'], ['kubernetesClusters', 'Kubernetes Clusters'], ['virtualMachines', 'Virtual Machines']] as const;
const limitLabel = (value: number | null | undefined) => value === null ? 'Unlimited' : value === undefined ? 'Unavailable' : value.toLocaleString();

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
  const [planKey, setPlanKey] = useState(initialWorkspace.plan.key);
  const [confirmation, setConfirmation] = useState('');
  const [overLimit, setOverLimit] = useState(false);
  const [retainExisting, setRetainExisting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const intent = useRef<{ key: string; body: any } | null>(null);
  const restoring = action === 'restore';
  const isPlan = action === 'plan';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError('');
    const fields = { expectedPolicyVersion: policy.policyVersion, ...(isPlan ? { planKey, overLimitBehavior: retainExisting ? 'retain_existing' : 'reject', reason: `Platform admin changed workspace plan from ${policy.plan.key} to ${planKey}` } : { workspaceName: confirmation, source: 'admin', reason: `Platform admin ${restoring ? 'restored' : 'suspended'} workspace member access` }) };
    const key = JSON.stringify(fields);
    if (intent.current?.key !== key) intent.current = { key, body: { ...fields, requestId: crypto.randomUUID() } };
    try {
      const result = await adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/${action}`, { method: isPlan ? 'PATCH' : 'POST', body: intent.current.body });
      onDone(result);
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.code === 'WORKSPACE_POLICY_VERSION_CONFLICT') {
        intent.current = null;
        try { setPolicy(await adminApi(`/workspaces/${encodeURIComponent(workspace.id)}/policy`)); setConfirmation(''); setRetainExisting(false); setShowFreshPolicy(true); setError('Policy changed. Review the latest state and submit a new confirmation.'); }
        catch (refreshError) { setError(readableError(refreshError)); }
      } else if (reason instanceof AdminApiError && reason.code === 'VALIDATION_ERROR' && /usage exceeds/.test(reason.message)) {
        setOverLimit(true); setError('Usage exceeds this plan. Confirm retaining existing resources and letting active work drain to continue.');
      } else setError(readableError(reason));
    } finally { setPending(false); }
  };
  return <ActionDialog title={isPlan ? `Change ${workspace.name} Plan` : `${restoring ? 'Restore' : 'Suspend'} ${workspace.name}`} description={isPlan ? 'Updates effective limits while preserving explicit overrides and existing resources.' : restoring ? 'Removes only the admin hold. An external hold can keep this workspace suspended.' : 'Blocks member access, cancels queued work and requests controlled cancellation of running work. Resources and memberships are retained.'} submitLabel={isPlan ? 'Update Plan' : `${restoring ? 'Restore' : 'Suspend'} Workspace`} danger={!isPlan && !restoring} pending={pending} error={error} onClose={onClose} onSubmit={submit} submitDisabled={isPlan ? planKey === policy.plan.key || (overLimit && !retainExisting) : confirmation !== workspace.name}>
    {showFreshPolicy && <WorkspacePolicySummary policy={policy} />}
    <HelpText>Policy version {policy.policyVersion}. {policy.holds.some((hold: any) => hold.source === 'external') ? 'An external hold is active.' : ''}</HelpText>
    {isPlan ? <><FieldLabel>Plan</FieldLabel><Select value={planKey} onChange={(value) => { setPlanKey(value); setOverLimit(false); setRetainExisting(false); }} options={plans.map((plan: any) => ({ value: plan.key, label: plan.name }))} />{overLimit && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={retainExisting} onChange={event => setRetainExisting(event.target.checked)} />Retain existing resources and let active work drain under the new limits.</label>}</> : <><FieldLabel htmlFor="workspace-confirmation" className="text-sm font-normal leading-5 normal-case tracking-normal">Type <strong className="font-semibold">{workspace.name}</strong> to confirm</FieldLabel><TextInput id="workspace-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /><HelpText>The name must match exactly.</HelpText></>}
  </ActionDialog>;
}
