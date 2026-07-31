import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FileText, GitBranch, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  CloseButton,
  DataSurface,
  DataTable,
  DataTableFrame,
  DataTableHeaderCell,
  DialogFrame,
  EmptyState,
  FieldLabel,
  HelpText,
  InlineAlert,
  LoadingState,
  MenuItem,
  ModalStepIndicator,
  OverflowActionMenu,
  PageHeader,
  SegmentedTabs,
  Select,
  StatusBadge,
  Switch,
  Textarea,
  TextInput
} from '@acornops/ui';
import { adminApi, readableError } from '../api';
import type { PageProps } from '../app-types';
import { ActionDialog } from '../components/ActionDialog';
import { importSkillFromGit } from '../lib/git-skill-import.js';

const destinations: Record<string, string> = { agents: 'Agents', kubernetes: 'Kubernetes', virtual_machines: 'Virtual machines' };
const allDestinations = Object.keys(destinations);
const defaultSkillDescription = 'Describe when this troubleshooting skill should be applied.';
const defaultSkillBody = `## Purpose

Describe the target troubleshooting workflow this skill supports.

## Guidance

- Add the primary investigation steps.
- Capture target-specific assumptions and guardrails.
- Use supporting Markdown files for longer runbooks or background context.`;
type Tab = 'mcp' | 'skills';
type WorkspaceDefault = {
  id: string;
  kind: 'mcp_server' | 'skill';
  name: string;
  description: string;
  availableIn: string[];
  enabled: boolean;
  source:
    | { type: 'https'; endpoint: string }
    | { type: 'manual' }
    | { type: 'git'; repoUrl: string; subpath?: string; commitSha: string };
};
const capabilityTabs = [
  { value: 'mcp', label: 'MCP servers' },
  { value: 'skills', label: 'Skills' }
] satisfies ReadonlyArray<{ value: Tab; label: string }>;

export function canonicalDestinations(value: string[] | string) {
  const selected = Array.isArray(value) ? value : value === 'all' ? allDestinations : [value];
  return allDestinations.filter((destination) => selected.includes(destination));
}

export function normalizeSkillName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 64).replace(/-+$/g, '');
}

export function buildManualSkillContent(
  name: string,
  description = defaultSkillDescription,
  instructions = defaultSkillBody
) {
  return `---\nname: ${normalizeSkillName(name)}\ndescription: ${JSON.stringify(description.trim())}\n---\n\n${instructions.trim()}\n`;
}

export function workspaceDefaultSourceLabel(item: WorkspaceDefault) {
  if (item.source.type === 'https') return item.source.endpoint;
  if (item.source.type === 'manual') return 'Manual skill';
  return `${item.source.repoUrl}${item.source.subpath ? ` / ${item.source.subpath}` : ''} @ ${item.source.commitSha.slice(0, 8)}`;
}

export function WorkspaceDefaultsPage({ canMutate, notify, navigate }: PageProps) {
  const params = new URLSearchParams(location.search);
  const [tab, setTabState] = useState<Tab>(params.get('tab') === 'skills' ? 'skills' : 'mcp');
  const [availableIn, setAvailableInState] = useState(params.get('availableIn') || '');
  const [query, setQueryState] = useState(params.get('q') || '');
  const [items, setItems] = useState<WorkspaceDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [pendingDefaultId, setPendingDefaultId] = useState('');
  const [dialog, setDialog] = useState<'add-mcp' | 'import-skill' | 'create-skill' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<WorkspaceDefault | null>(null);

  const syncUrl = (next: { tab?: Tab; availableIn?: string; q?: string }) => {
    const values = { tab: next.tab ?? tab, availableIn: next.availableIn ?? availableIn, q: next.q ?? query };
    const url = new URLSearchParams({ tab: values.tab });
    if (values.availableIn) url.set('availableIn', values.availableIn);
    if (values.q) url.set('q', values.q);
    navigate(`/workspace-defaults?${url}`, { replace: true });
  };
  const setTab = (value: Tab) => { setTabState(value); syncUrl({ tab: value }); };
  const setAvailableIn = (value: string) => { setAvailableInState(value); syncUrl({ availableIn: value }); };
  const setQuery = (value: string) => { setQueryState(value); syncUrl({ q: value.trim() }); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const apiQuery = new URLSearchParams({ kind: tab === 'mcp' ? 'mcp_server' : 'skill' });
    if (availableIn) apiQuery.set('availableIn', availableIn);
    if (query.trim()) apiQuery.set('q', query.trim());
    try {
      const response = await adminApi<any>(`/workspace-defaults?${apiQuery}`);
      setItems(response.items || []);
    } catch (reason) { setError(readableError(reason)); } finally { setLoading(false); }
  }, [availableIn, query, tab]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 180); return () => window.clearTimeout(timer); }, [load]);

  const setDefaultEnabled = async (item: WorkspaceDefault, enabled: boolean) => {
    setPendingDefaultId(item.id);
    setMutationError('');
    try {
      const updated = await adminApi<WorkspaceDefault>(`/workspace-defaults/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: {
          enabled,
          reason: `${enabled ? 'Enabled' : 'Disabled'} platform workspace default`
        }
      });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? updated : candidate));
      notify(enabled
        ? `${item.name} will be included in new workspaces.`
        : `${item.name} will be skipped when new workspaces are created.`);
    } catch (reason) {
      setMutationError(readableError(reason));
    } finally {
      setPendingDefaultId('');
    }
  };

  return (
    <>
      <PageHeader title="Capabilities" description="New workspaces are created with these defaults, while existing workspaces remain unchanged." />
      <SegmentedTabs
        activeValue={tab}
        allPanelsMounted={false}
        ariaLabel="Workspace default type"
        className="mb-5"
        idBase="workspace-defaults"
        items={capabilityTabs}
        onValueChange={setTab}
      />
      <div
        id={`workspace-defaults-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`workspace-defaults-${tab}-tab`}
      >
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm leading-6 text-ui-text-muted sm:whitespace-nowrap">
            {tab === 'mcp' ? 'Workspace users have to explicitly enable the MCP servers they want to use, then configure authentication through the existing MCP setup.' : 'Workspace users have to explicitly enable the skills they want to use.'}
          </p>
          {canMutate && (tab === 'mcp'
            ? <Button className="shrink-0" onClick={() => { setSelected(null); setDialog('add-mcp'); }}><Plus className="h-4 w-4" />Add MCP server</Button>
            : <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { setSelected(null); setDialog('import-skill'); }}><GitBranch className="h-4 w-4" />Import skill</Button>
                <Button variant="secondary" onClick={() => { setSelected(null); setDialog('create-skill'); }}><Plus className="h-4 w-4" />Create skill</Button>
              </div>)}
        </div>
        {mutationError && <InlineAlert tone="danger" className="mb-4">{mutationError}</InlineAlert>}
        <DataSurface toolbarFullWidth toolbar={
          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
            <label className="relative block min-w-0"><span className="sr-only">Search defaults</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ui-text-muted" /><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tab === 'mcp' ? 'MCP servers' : 'skills'}`} className="pl-10" /></label>
            <Select value={availableIn} onChange={setAvailableIn} ariaLabel="Filter by Available in" className="w-full" options={[{ value: '', label: 'All destinations' }, ...Object.entries(destinations).map(([value, label]) => ({ value, label }))]} />
            <span className="inline-flex h-11 items-center self-start rounded-md bg-ui-surface-strong px-3 text-xs font-semibold text-ui-text-muted sm:self-auto">{items.length} {items.length === 1 ? 'default' : 'defaults'}</span>
          </div>
        }>
          {loading ? <LoadingState label="Loading capability defaults" /> : error ? <div className="p-5"><InlineAlert tone="danger">{error}</InlineAlert></div> : items.length ? (
            <DataTableFrame>
              <DataTable caption={tab === 'mcp' ? 'MCP Server Defaults' : 'Skill Defaults'} className="min-w-[52rem] table-fixed">
                <thead><tr><DataTableHeaderCell density="compact" className="w-[30%]">{tab === 'mcp' ? 'MCP Server' : 'Skill'}</DataTableHeaderCell><DataTableHeaderCell density="compact" className="w-[35%]">Available In</DataTableHeaderCell><DataTableHeaderCell density="compact" className="w-[23%]">Default</DataTableHeaderCell><DataTableHeaderCell density="compact" className="w-[12%] text-right">Actions</DataTableHeaderCell></tr></thead>
                <tbody>{items.map((item) => <tr className="data-row" key={item.id}>
                  <td data-primary="true" data-label={tab === 'mcp' ? 'MCP Server' : 'Skill'} className="px-5 py-4"><strong className="block text-sm text-ui-text">{item.name}</strong><span className="mono block break-all text-xs text-ui-text-muted">{workspaceDefaultSourceLabel(item)}</span></td>
                  <td data-label="Available In" className="px-5 py-4"><div className="flex flex-wrap gap-1">{canonicalDestinations(item.availableIn).length === allDestinations.length ? <StatusBadge>All</StatusBadge> : canonicalDestinations(item.availableIn).map((value) => <StatusBadge key={value}>{destinations[value]}</StatusBadge>)}</div></td>
                  <td data-label="Default" className="px-5 py-4"><div className="flex items-center gap-2"><Switch checked={item.enabled !== false} label={`${item.enabled === false ? 'Turn on' : 'Turn off'} default for ${item.name}`} disabled={!canMutate || pendingDefaultId === item.id} onCheckedChange={(enabled) => void setDefaultEnabled(item, enabled)} /><span className="text-xs font-semibold text-ui-text-muted">{item.enabled === false ? 'Off' : 'On'}</span></div></td>
                  <td data-label="Actions" className="px-5 py-4"><div className="responsive-actions flex justify-end"><OverflowActionMenu label={`Actions for ${item.name}`} disabled={!canMutate}>{(close) => <><MenuItem onClick={() => { close(); setSelected(item); setDialog('edit'); }}><Pencil className="h-4 w-4 shrink-0 text-ui-text-muted" aria-hidden="true" />Edit Availability</MenuItem><MenuItem destructive onClick={() => { close(); setSelected(item); setDialog('delete'); }}><Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />Delete</MenuItem></>}</OverflowActionMenu></div></td>
                </tr>)}</tbody>
              </DataTable>
            </DataTableFrame>
          ) : <EmptyState embedded icon={<SlidersHorizontal />} title={`No ${tab === 'mcp' ? 'MCP Servers' : 'Skills'} Found`} description="Add a default or change the filters." />}
        </DataSurface>
        {!canMutate && <HelpText>Your platform role has read-only access.</HelpText>}
      </div>
      {dialog === 'add-mcp' && <AddMcpDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); notify('MCP server default added.'); }} />}
      {dialog === 'import-skill' && <ImportSkillDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); notify('Skill default imported.'); }} />}
      {dialog === 'create-skill' && <CreateSkillDialog onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); notify('Skill default created.'); }} />}
      {dialog === 'edit' && selected && <AvailabilityDialog item={selected} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); notify('Availability updated.'); }} />}
      {dialog === 'delete' && selected && <DefaultMutationDialog title="Delete Default" description={`Delete ${selected.name} from the initialization list. Existing workspaces are unchanged.`} submitLabel="Delete" danger request={() => adminApi(`/workspace-defaults/${encodeURIComponent(selected.id)}`, { method: 'DELETE', body: { reason: 'Deleted platform workspace default' } })} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); notify('Default deleted.'); }} />}
    </>
  );
}

function DestinationChoices({ selected, onChange }: { selected: string[]; onChange: (value: string[]) => void }) {
  const hasSelection = selected.length > 0;
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <fieldset>
    <legend className="sr-only">Available In</legend>
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-ui-text" aria-hidden="true">Available In</span>
      <button type="button" className="text-xs font-semibold text-accent-readable underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25" onClick={() => onChange(hasSelection ? [] : allDestinations)}>
        {hasSelection ? 'Clear' : 'Select all'}
      </button>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {Object.entries(destinations).map(([value, label]) => {
        const isSelected = selected.includes(value);
        return <label key={value} data-selected={isSelected} className="destination-choice flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-ui-border bg-ui-surface p-3 text-sm text-ui-text transition-colors hover:border-accent/25 motion-reduce:transition-none">
          <Checkbox checked={isSelected} onChange={() => toggle(value)} />
          {label}
        </label>;
      })}
    </div>
  </fieldset>;
}

function AddMcpDialog({ onClose, onDone }: any) {
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [availableIn, setAvailableIn] = useState(allDestinations);
  return <DefaultMutationDialog title="Add MCP Server" description="Add an HTTPS endpoint to the initialization list for new workspaces." submitLabel="Add MCP server" pendingLabel="Adding server…" submitDisabled={!name.trim() || !/^https:\/\//.test(endpoint) || !availableIn.length} request={() => adminApi('/workspace-defaults', { method: 'POST', body: { kind: 'mcp_server', name: name.trim(), availableIn, source: { type: 'https', endpoint }, reason: 'Added platform MCP server default' } })} onClose={onClose} onDone={onDone}>
    <div className="grid gap-4 sm:grid-cols-2"><div><FieldLabel>Name</FieldLabel><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. GitHub" className="mt-2" /></div><div><FieldLabel>HTTPS endpoint</FieldLabel><TextInput type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://mcp.example.com" className="mt-2" /></div></div>
    <InlineAlert tone="neutral"><strong className="text-ui-text">Authentication stays in each workspace.</strong> Workspace users configure authentication and credentials through the existing MCP setup.</InlineAlert>
    <DestinationChoices selected={availableIn} onChange={setAvailableIn} />
  </DefaultMutationDialog>;
}

function ImportSkillDialog({ onClose, onDone }: any) {
  const [provider, setProvider] = useState('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [ref, setRef] = useState('');
  const [subpath, setSubpath] = useState('');
  const [availableIn, setAvailableIn] = useState(allDestinations);
  return <DefaultMutationDialog title="Import Skill" description="Import a validated snapshot from a public GitHub or GitLab repository." submitLabel="Import skill" pendingLabel="Importing skill…" submitDisabled={!repoUrl.startsWith('https://') || !availableIn.length} request={async () => {
    const imported = await importSkillFromGit({ provider, repoUrl, ref, subpath });
    await adminApi('/workspace-defaults', { method: 'POST', body: { kind: 'skill', availableIn, source: imported.source, files: imported.files, reason: 'Imported platform skill default' } });
  }} onClose={onClose} onDone={onDone}>
    <div><FieldLabel>Provider</FieldLabel><Select value={provider} onChange={setProvider} className="mt-2" options={[{ value: 'github', label: 'GitHub' }, { value: 'gitlab', label: 'GitLab' }]} /></div>
    <div><FieldLabel>Repository URL</FieldLabel><TextInput type="url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/openai/skills/tree/main/skills/.curated/example" className="mt-2" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><FieldLabel>Ref</FieldLabel><TextInput value={ref} onChange={(event) => setRef(event.target.value)} placeholder="Defaults to the repository branch" className="mt-2" /></div><div><FieldLabel>Subpath</FieldLabel><TextInput value={subpath} onChange={(event) => setSubpath(event.target.value)} placeholder="skills/example" className="mt-2" /></div></div>
    <InlineAlert tone="neutral"><strong className="text-ui-text">Imported snapshot.</strong> The selected ref is resolved to an immutable commit and only Markdown skill files are imported.</InlineAlert>
    <DestinationChoices selected={availableIn} onChange={setAvailableIn} />
  </DefaultMutationDialog>;
}

function CreateSkillDialog({ onClose, onDone }: any) {
  type Step = 'name' | 'files' | 'availability';
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const [availableIn, setAvailableIn] = useState(allDestinations);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const normalizedName = normalizeSkillName(name);
  const steps = [
    { id: 'name', label: 'Name' },
    { id: 'files', label: 'Edit files' },
    { id: 'availability', label: 'Availability' }
  ];
  const nextFromName = () => {
    if (!normalizedName) return;
    setSkillContent(buildManualSkillContent(name));
    setError('');
    setStep('files');
  };
  const create = async () => {
    if (!skillContent.trim() || !availableIn.length) return;
    setPending(true);
    setError('');
    try {
      await adminApi('/workspace-defaults', {
        method: 'POST',
        body: {
          kind: 'skill',
          availableIn,
          source: { type: 'manual' },
          files: [{ path: 'SKILL.md', content: skillContent }],
          reason: 'Created platform skill default'
        }
      });
      onDone();
    } catch (reason) {
      setError(readableError(reason));
      setPending(false);
    }
  };

  return <DialogFrame
    unframed
    titleId="create-platform-skill-title"
    closeDisabled={pending}
    onClose={onClose}
    className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-surface shadow-2xl ${
      step === 'files' ? 'max-w-6xl' : 'max-w-xl'
    }`}
  >
    <div className="flex items-start justify-between gap-4 border-b border-ui-border bg-ui-bg px-6 py-4">
      <div className="min-w-0">
        <h3 id="create-platform-skill-title" className="type-panel-title">Create Skill</h3>
        <ModalStepIndicator steps={steps} currentStepId={step} compactOnMobile className="mt-4" />
      </div>
      <CloseButton onClick={onClose} disabled={pending} aria-label="Close skill editor" />
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
      {step === 'name' ? (
        <div className="rounded-lg border border-ui-border bg-ui-bg p-5">
          <label className="space-y-1">
            <span className="type-label px-1">Skill name</span>
            <TextInput
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              placeholder="Troubleshooting CNPG"
              className="px-4 type-ui"
            />
          </label>
          <p className="type-caption mt-3 text-ui-text-muted">
            The next step creates a starter SKILL.md. You can edit the YAML header and body before saving.
          </p>
        </div>
      ) : step === 'files' ? (
        <div className="grid min-h-[34rem] gap-0 overflow-hidden rounded-lg border border-ui-border bg-ui-bg lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-ui-border bg-ui-bg lg:border-b-0 lg:border-r">
            <div className="border-b border-ui-border px-4 py-3"><h4 className="type-row-title">Files</h4></div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3 custom-scrollbar">
              <button type="button" className="control-target relative flex w-full min-w-0 items-center gap-2 rounded-md bg-accent-soft/20 py-1.5 pr-2 pl-2.5 text-left type-caption text-accent-strong">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">SKILL.md</span>
              </button>
              <p className="type-caption ml-7 rounded-md px-2 py-1.5 text-ui-text-muted">No supporting files.</p>
            </div>
          </aside>
          <section className="flex min-w-0 flex-col bg-ui-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3">
              <p className="type-label truncate text-ui-text">SKILL.md</p>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <Textarea
                value={skillContent}
                maxLength={32768}
                onChange={(event) => setSkillContent(event.target.value)}
                className="h-full min-h-[28rem] w-full resize-none rounded-lg border border-ui-border bg-ui-bg px-4 py-3 font-mono type-body leading-6 text-ui-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                spellCheck={false}
                aria-label="SKILL.md content"
              />
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-ui-border bg-ui-bg p-5">
          <p className="type-caption mb-5 text-ui-text-muted">
            Choose where this skill will be available in new workspaces.
          </p>
          <DestinationChoices selected={availableIn} onChange={setAvailableIn} />
        </div>
      )}
      {error && <InlineAlert tone="danger" className="mt-4">{error}</InlineAlert>}
    </div>

    <div className="flex items-center justify-between gap-3 border-t border-ui-border bg-ui-bg px-6 py-4">
      <span />
      <div className="flex justify-end gap-3">
        {step === 'name' ? (
          <>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={nextFromName} disabled={!normalizedName || pending}>Next</Button>
          </>
        ) : step === 'files' ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setStep('name')} disabled={pending}>Back</Button>
            <Button variant="primary" size="sm" onClick={() => setStep('availability')} disabled={!skillContent.trim() || pending}>Next</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={() => setStep('files')} disabled={pending}>Back</Button>
            <Button variant="primary" size="sm" onClick={() => void create()} disabled={!availableIn.length || pending}>
              {pending ? 'Creating...' : 'Create Skill'}
            </Button>
          </>
        )}
      </div>
    </div>
  </DialogFrame>;
}

function AvailabilityDialog({ item, onClose, onDone }: any) {
  const [availableIn, setAvailableIn] = useState(canonicalDestinations(item.availableIn));
  return <DefaultMutationDialog title="Edit Availability" description={`Choose where ${item.name} will appear in.`} submitLabel="Save" submitDisabled={!availableIn.length || JSON.stringify(availableIn) === JSON.stringify(canonicalDestinations(item.availableIn))} request={() => adminApi(`/workspace-defaults/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { availableIn, reason: 'Updated platform default availability' } })} onClose={onClose} onDone={onDone}><DestinationChoices selected={availableIn} onChange={setAvailableIn} /></DefaultMutationDialog>;
}

function DefaultMutationDialog({ title, description, submitLabel, pendingLabel, danger, request, onClose, onDone, children, submitDisabled }: any) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError('');
    try { await request(); onDone(); } catch (reason) { setError(readableError(reason)); setPending(false); }
  };
  return <ActionDialog title={title} description={description} submitLabel={submitLabel} pendingLabel={pendingLabel} danger={danger} pending={pending} error={error} submitDisabled={submitDisabled} onClose={onClose} onSubmit={submit}>{children}</ActionDialog>;
}
