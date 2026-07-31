import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Clipboard, Eye, ShieldCheck } from 'lucide-react';
import {
  Button,
  CloseButton,
  DataSurface,
  EmptyState,
  InlineAlert,
  LoadingState,
  PageHeader,
  RightSidePanel,
  Select,
  TextInput
} from '@acornops/ui';
import { adminApi, readableError } from '../api';
import type { PageProps } from '../app-types';
import { formatDate, titleCase } from '../lib';

const actionLabels = new Map([
  ['admin.system.setting.update', 'Updated Platform Setting'],
  ['admin.system.setting.reset', 'Reset Platform Setting'],
  ['admin.system.llm_provider_default.update', 'Updated Default LLM Key'],
  ['admin.system.llm_provider_default.delete', 'Deleted Default LLM Key'],
  ['admin.workspace.plan.update', 'Changed Workspace Plan'],
  ['admin.workspace.suspend', 'Modified Workspace Status'],
  ['admin.workspace.restore', 'Modified Workspace Status'],
  ['admin.workspace.member.add', 'Modified Workspace Access'],
  ['admin.workspace.member.delete', 'Modified Workspace Access'],
  ['admin.workspace.member.role.update', 'Updated Member Role'],
  ['admin.member.role.update', 'Updated Member Role']
]);

export function buildAuditQuery(values: Record<string, unknown>, from = '', to = '') {
  const query = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => { if (String(value || '').trim()) query.set(key, String(value).trim()); });
  if (from) query.set('from', new Date(from).toISOString());
  if (to) query.set('to', new Date(to).toISOString());
  return query;
}

export function auditPresetRange(preset: string, currentTime = new Date()) {
  const now = new Date(currentTime);
  const from = new Date(now);
  if (preset === 'today') from.setHours(0, 0, 0, 0);
  else if (preset === '24h') from.setHours(from.getHours() - 24);
  else if (preset === '7d' || preset === '30d') from.setDate(from.getDate() - Number.parseInt(preset, 10));
  else throw new Error('Unsupported audit time preset');
  return { now, from };
}

export function auditActorName(event: any = {}) {
  return event.adminActorDisplayName || event.adminActorEmail || event.adminActorSubject || 'Unknown administrator';
}

export function humanizeAuditAction(action = '') {
  return String(action || 'unknown').split('.').map((part) => titleCase(part)).join(' · ');
}

const canonicalAuditAction = (action = '') => String(action || 'unknown').replace(/\.request$/, '');

export function auditAffectedParts(event: any = {}) {
  return [
    event.workspaceId ? { label: 'Workspace', value: event.workspaceName || event.workspaceId } : null,
    event.subjectId
      ? {
          label: titleCase(event.subjectType || 'Item'),
          value: event.subjectType === 'user'
            ? event.subjectDisplayName || 'Unknown user'
            : event.subjectId
        }
      : null
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

export function auditAffectedText(event: any) {
  return auditAffectedParts(event).map(({ label, value }) => `${label} ${value}`).join(' · ') || 'Platform';
}

export function rawAuditKeyValues(event: any) {
  const entries: Array<[string, unknown]> = [];
  Object.entries(event || {}).forEach(([key, value]) => {
    if (key !== 'metadata' && value !== undefined && value !== null) entries.push([key, typeof value === 'object' ? JSON.stringify(value) : value]);
  });
  Object.entries(event?.metadata || {}).forEach(([key, value]) => {
    if (key !== 'ticketRef' && value !== undefined && value !== null) entries.push([key, typeof value === 'object' ? JSON.stringify(value) : value]);
  });
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join('\n') || 'No event data';
}

const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const labelEvent = (action: string) => {
  const canonical = canonicalAuditAction(action);
  return actionLabels.get(canonical) || titleCase(canonical.replace(/^admin\./, '').replaceAll('_', ' ').replaceAll('.', ' '));
};

export function auditEventText(event: any = {}) {
  const reason = typeof event.reason === 'string'
    ? event.reason.trim().replace(/^platform admin\s+/i, '').replace(/^./, (first: string) => first.toUpperCase())
    : '';
  const action = canonicalAuditAction(event.action);
  const workspace = event.workspaceName || 'the workspace';
  const subject = event.subjectDisplayName || 'the user';
  const roleValue = event.metadata?.afterRole
    || event.metadata?.nextRole
    || event.metadata?.requestedRole
    || event.metadata?.previousRole;
  const role = roleValue ? titleCase(String(roleValue)) : '';

  switch (action) {
    case 'admin.workspace.plan.update': {
      const plan = event.metadata?.afterPlan || event.metadata?.requestedPlan;
      return plan
        ? `Changed ${workspace} to the ${titleCase(String(plan))} plan`
        : `Changed the plan for ${workspace}`;
    }
    case 'admin.workspace.suspend':
      return `Suspended ${workspace}`;
    case 'admin.workspace.restore':
      return `Restored ${workspace}`;
    case 'admin.workspace.member.add':
      return role
        ? `Granted ${role} access to ${workspace}`
        : reason || `Granted access to ${workspace}`;
    case 'admin.workspace.member.delete':
      return `Revoked ${subject}'s access to ${workspace}`;
    case 'admin.workspace.member.role.update':
    case 'admin.member.role.update':
      return role
        ? `Changed ${subject}'s role to ${role} in ${workspace}`
        : `Changed ${subject}'s role in ${workspace}`;
    case 'admin.system.setting.update':
      return 'Updated a platform setting';
    case 'admin.system.setting.reset':
      return 'Reset a platform setting';
    case 'admin.system.llm_provider_default.update':
      return 'Updated a default LLM key';
    case 'admin.system.llm_provider_default.delete':
      return 'Deleted a default LLM key';
    default:
      return reason || labelEvent(action);
  }
}

function AuditObject({ event }: { event: any }) {
  const parts = auditAffectedParts(event);
  return (
    <div className="space-y-1 text-sm text-ui-text">
      {parts.length
        ? parts.map(({ label, value }) => <div key={`${label}-${value}`}><span className="text-xs text-ui-text-muted">{label}</span> <span>{value}</span></div>)
        : <span>Platform</span>}
    </div>
  );
}

export function AuditPage({ notify }: PageProps) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ action: '', workspaceQuery: '', adminActorSubject: '', outcome: '', from: '', to: '' });
  const [activeQuery, setActiveQuery] = useState(new URLSearchParams());
  const [activeTimePreset, setActiveTimePreset] = useState('');
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const requestSequence = useRef(0);

  const load = useCallback(async (append = false, query = activeQuery) => {
    if (append && (loadingRef.current || !nextCursor)) return;
    const requestId = ++requestSequence.current;
    loadingRef.current = true;
    setLoading(true); setError('');
    const params = new URLSearchParams(query);
    params.set('limit', '50');
    if (append && nextCursor) params.set('cursor', nextCursor);
    try {
      const response = await adminApi<any>(`/admin-audit-events?${params}`);
      if (requestId !== requestSequence.current) return;
      setItems((current) => append
        ? [...current, ...(response.items || []).filter((item: any) => !current.some((known) => known.id === item.id))]
        : response.items || []);
      setNextCursor(response.nextCursor || '');
    } catch (reason) {
      if (requestId === requestSequence.current) setError(readableError(reason));
    } finally {
      if (requestId === requestSequence.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [activeQuery, nextCursor]);
  useEffect(() => { void load(false); }, []); // initial governance ledger
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void load(true);
    }, { rootMargin: '240px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [load, nextCursor]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const actionGroup = filters.action.startsWith('group:');
    const query = buildAuditQuery({
      [actionGroup ? 'actionGroup' : 'action']: filters.action.replace(/^group:/, ''),
      workspaceQuery: filters.workspaceQuery,
      adminActorSubject: filters.adminActorSubject,
      outcome: filters.outcome
    }, filters.from, filters.to);
    setActiveQuery(query);
    void load(false, query);
  };
  const preset = (value: string) => {
    const range = auditPresetRange(value);
    const next = { ...filters, from: localDateTime(range.from), to: localDateTime(range.now) };
    setFilters(next);
    setActiveTimePreset(value);
    setCustomRangeOpen(false);
    const actionGroup = next.action.startsWith('group:');
    const query = buildAuditQuery({
      [actionGroup ? 'actionGroup' : 'action']: next.action.replace(/^group:/, ''),
      workspaceQuery: next.workspaceQuery,
      adminActorSubject: next.adminActorSubject,
      outcome: next.outcome
    }, next.from, next.to);
    setActiveQuery(query);
    void load(false, query);
  };
  const clear = () => {
    const next = { action: '', workspaceQuery: '', adminActorSubject: '', outcome: '', from: '', to: '' };
    setFilters(next);
    setActiveTimePreset('');
    setCustomRangeOpen(false);
    setActiveQuery(new URLSearchParams());
    void load(false, new URLSearchParams());
  };

  return (
    <>
      <PageHeader className="audit-page-header" title="Admin Audit" description="A platform-level record of privileged admin actions. Workspace audit events are intentionally omitted, and should be viewed in the respective workspace-level audit." />
      <DataSurface className="audit-surface">
        <form className="border-b border-ui-border bg-ui-surface p-4" onSubmit={apply}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Select value={filters.action} onChange={(action) => setFilters((current) => ({ ...current, action }))} ariaLabel="Filter by event" options={[
              { value: '', label: 'All events' },
              { value: 'admin.workspace.plan.update', label: 'Changed Workspace Plan' },
              { value: 'group:workspace_status_modified', label: 'Modified Workspace Status' },
              { value: 'group:workspace_access_modified', label: 'Modified User Access' },
              { value: 'group:platform_settings_modified', label: 'Modified Workspace Defaults' },
              { value: 'group:llm_provider_defaults_modified', label: 'Modified AI Providers Defaults' },
              { value: 'group:workspace_defaults_modified', label: 'Modified Capabilities Defaults' }
            ]} />
            <TextInput value={filters.workspaceQuery} onChange={(event) => setFilters((current) => ({ ...current, workspaceQuery: event.target.value }))} placeholder="Workspace name or ID" aria-label="Filter by workspace name or ID" />
            <TextInput value={filters.adminActorSubject} onChange={(event) => setFilters((current) => ({ ...current, adminActorSubject: event.target.value }))} placeholder="Admin actor" aria-label="Filter by admin actor" />
            <Select value={filters.outcome} onChange={(outcome) => setFilters((current) => ({ ...current, outcome }))} ariaLabel="Filter by outcome" options={[{ value: '', label: 'All outcomes' }, { value: 'success', label: 'Success' }, { value: 'failure', label: 'Failure' }]} />
          </div>
          <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-ui-border pt-4 lg:flex-row lg:items-center lg:justify-between">
            <fieldset>
              <legend className="sr-only">Time Period</legend>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {[['today', 'Today'], ['24h', 'Last 24h'], ['7d', 'Past 7d'], ['30d', 'Past 30d']].map(([value, label]) => (
                  <Button className="audit-time-filter w-full sm:w-auto" key={value} type="button" variant="secondary" size="sm" aria-pressed={activeTimePreset === value} onClick={() => preset(value)}>{label}</Button>
                ))}
                <Button
                  className="audit-time-filter col-span-2 w-full sm:w-auto"
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-pressed={customRangeOpen}
                  aria-expanded={customRangeOpen}
                  aria-controls="audit-custom-range"
                  onClick={() => { setActiveTimePreset(''); setCustomRangeOpen((open) => !open); }}
                >
                  Custom range
                </Button>
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button className="w-full sm:w-auto" type="button" onClick={clear}>Clear</Button>
              <Button className="w-full sm:w-auto" type="submit" variant="primary">Apply filters</Button>
            </div>
          </div>
          {customRangeOpen && (
            <div id="audit-custom-range" className="mt-3 grid min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-bg p-3 sm:grid-cols-2 lg:max-w-[34rem]">
              <label className="min-w-0 text-xs font-semibold text-ui-text-muted">From<TextInput type="datetime-local" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="mt-1 min-w-0" /></label>
              <label className="min-w-0 text-xs font-semibold text-ui-text-muted">To<TextInput type="datetime-local" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="mt-1 min-w-0" /></label>
            </div>
          )}
        </form>
        {loading && !items.length ? <LoadingState label="Loading governance events" /> : error && !items.length ? <div className="p-5"><InlineAlert tone="danger">{error}</InlineAlert></div> : items.length ? (
          <>
            <div className="audit-grid-header type-micro-label border-b border-ui-border bg-ui-bg text-ui-text-muted">
              <span>Time</span><span>Event</span><span>Actor</span><span>Object</span><span>Details</span>
            </div>
            <div>{items.map((event, index) => <article key={event.id || `${event.occurredAt}-${index}`} className="audit-record data-row">
              <div className="audit-cell" data-label="Time"><time className="text-xs text-ui-text-muted" dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></div>
              <div className="audit-cell" data-label="Event"><div><strong className="text-sm text-ui-text">{auditEventText(event)}</strong><div className="mt-1 break-words text-xs text-ui-text-muted">{event.action || 'unknown'} · {titleCase(event.outcome || 'unknown')}</div></div></div>
              <div className="audit-cell text-sm text-ui-text" data-label="Actor">{auditActorName(event)}</div>
              <div className="audit-cell" data-label="Object"><AuditObject event={event} /></div>
              <div className="audit-cell" data-label="Details"><Button variant="icon" size="icon" aria-label={`View details for ${labelEvent(event.action)}`} onClick={() => setSelected(event)}><Eye className="h-4 w-4" /></Button></div>
            </article>)}</div>
            {nextCursor && (
              <div className="border-t border-ui-border p-4">
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />
                <div className="flex justify-center">
                  <Button onClick={() => void load(true)} disabled={loading}>{loading ? 'Loading more…' : 'Load more'}</Button>
                </div>
              </div>
            )}
            {error && <div className="p-4"><InlineAlert tone="danger">Unable to load more events. {error}</InlineAlert></div>}
          </>
        ) : <EmptyState embedded icon={<ShieldCheck />} title="No Matching Admin Activity" description="Adjust the filters or time period." />}
      </DataSurface>
      <RightSidePanel isOpen={Boolean(selected)} onClose={() => setSelected(null)} titleId="audit-detail-title">
        {selected && <>
          <header className="flex items-start justify-between gap-3 border-b border-ui-border bg-ui-bg px-4 py-4 sm:gap-4 sm:px-6"><div className="min-w-0"><p className="text-xs font-semibold text-ui-text-muted">Governance</p><h2 id="audit-detail-title" className="break-words text-lg font-semibold text-ui-text">{auditEventText(selected)}</h2></div><CloseButton aria-label="Close audit details" onClick={() => setSelected(null)} /></header>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <dl className="audit-detail-table border-y border-ui-border">{[
              ['Time', formatDate(selected.occurredAt)],
              ['Event type', humanizeAuditAction(selected.action)],
              ['Outcome', titleCase(selected.outcome || 'unknown')],
              ['Actor', auditActorName(selected)],
              ['Object', auditAffectedText(selected)],
              ['Correlation ID', selected.metadata?.correlationId || 'Not applicable']
            ].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
            <div className="audit-log-copy relative mt-5 rounded-lg p-4"><Button variant="icon" size="icon" className="audit-log-copy-button absolute right-2 top-2" aria-label="Copy event data" onClick={() => navigator.clipboard.writeText(rawAuditKeyValues(selected)).then(() => notify('Event data copied.')).catch(() => notify({ message: 'Unable to copy event data.', tone: 'danger' }))}><Clipboard className="h-4 w-4" /></Button><pre className="custom-scrollbar overflow-x-auto pr-10 text-xs leading-5"><code>{rawAuditKeyValues(selected)}</code></pre></div>
          </div>
        </>}
      </RightSidePanel>
    </>
  );
}
