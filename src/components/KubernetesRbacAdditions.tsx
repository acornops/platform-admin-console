import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, RotateCcw, ShieldCheck, Trash2, Undo2 } from 'lucide-react';
import { parse, stringify } from 'yaml';
import {
  Button,
  DataSurface,
  DataTable,
  DataTableFrame,
  DataTableHeaderCell,
  EmptyState,
  FieldLabel,
  HelpText,
  InlineAlert,
  MenuItem,
  OverflowActionMenu,
  PageSection,
  StatusBadge,
  Textarea,
  TextInput
} from '@acornops/ui';
import { adminApi, readableError } from '../api';
import { ActionDialog } from './ActionDialog';

const RBAC_VERBS = ['get', 'list', 'watch', 'create', 'patch', 'delete'] as const;
type RbacVerb = typeof RBAC_VERBS[number];
const RBAC_VERB_SET = new Set<string>(RBAC_VERBS);
type RbacResource = {
  apiGroup: string;
  apiVersion: string;
  resource: string;
  kind: string;
  scope: 'namespaced' | 'cluster';
  verbs: RbacVerb[];
};
export type RbacProfile = {
  key: string;
  name: string;
  description?: string;
  resources: RbacResource[];
};
type RbacOverlay = { upserts: RbacProfile[]; disabledKeys: string[] };
type RbacSetting = {
  key: 'kubernetes_rbac_additions';
  value: { additions: RbacProfile[] };
  deploymentDefault: { additions: RbacProfile[] };
  overrideValue?: RbacOverlay;
  version: number;
  editable: boolean;
  warning?: string;
};
type ProfileRow = {
  profile: RbacProfile;
  source: 'deployment' | 'admin_override' | 'admin';
  disabled: boolean;
};
type DialogState =
  | { kind: 'add' }
  | { kind: 'edit'; row: ProfileRow }
  | { kind: 'disable' | 'delete' | 'restore' | 'reset'; row?: ProfileRow }
  | null;

const emptyOverlay = (): RbacOverlay => ({ upserts: [], disabledKeys: [] });
const exampleResources = {
  resources: [{
    apiGroup: 'postgresql.cnpg.io',
    apiVersion: 'v1',
    resource: 'clusters',
    kind: 'Cluster',
    scope: 'namespaced',
    verbs: RBAC_VERBS.filter((verb) => verb !== 'delete')
  }]
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeRbacProfileKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 64).replace(/-+$/g, '');
}

export function parseRbacResourcesYaml(value: string): RbacResource[] {
  const document = parse(value);
  if (!isPlainObject(document) || Object.keys(document).some((key) => key !== 'resources') || !Array.isArray(document.resources)) {
    throw new Error('YAML must contain exactly one resources list.');
  }
  if (document.resources.length < 1 || document.resources.length > 50) {
    throw new Error('Add between 1 and 50 resource rules.');
  }
  const resourcePlurals = new Set<string>();
  return document.resources.map((raw, index) => {
    if (!isPlainObject(raw) || Object.keys(raw).some((key) => !['apiGroup', 'apiVersion', 'resource', 'kind', 'scope', 'verbs'].includes(key))) {
      throw new Error(`Resource ${index + 1} contains unknown fields.`);
    }
    const apiGroup = String(raw.apiGroup || '').trim();
    const apiVersion = String(raw.apiVersion || '').trim();
    const resource = String(raw.resource || '').trim();
    const kind = String(raw.kind || '').trim();
    const scope = raw.scope;
    const verbs = raw.verbs;
    if (!/^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/.test(apiGroup) || apiGroup.length > 253) throw new Error(`Resource ${index + 1} has an invalid API group.`);
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(apiVersion) || apiVersion.length > 63) throw new Error(`Resource ${index + 1} has an invalid API version.`);
    if (!/^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/.test(resource) || resource.length > 253) throw new Error(`Resource ${index + 1} has an invalid plural resource name.`);
    if (!/^[A-Z][A-Za-z0-9]*$/.test(kind) || kind.length > 128) throw new Error(`Resource ${index + 1} has an invalid kind.`);
    if (scope !== 'namespaced' && scope !== 'cluster') throw new Error(`Resource ${index + 1} must use namespaced or cluster scope.`);
    if (!Array.isArray(verbs) || verbs.length < 1 || verbs.length > RBAC_VERBS.length || verbs.some((verb) => !RBAC_VERB_SET.has(String(verb))) || new Set(verbs).size !== verbs.length) {
      throw new Error(`Resource ${index + 1} may use only unique get, list, watch, create, patch, and delete verbs.`);
    }
    if (verbs.includes('patch') && !verbs.includes('list')) throw new Error(`Resource ${index + 1} must include list when patch is enabled.`);
    if (resourcePlurals.has(resource)) throw new Error(`Resource ${index + 1} duplicates the plural ${resource}.`);
    resourcePlurals.add(resource);
    return { apiGroup, apiVersion, resource, kind, scope, verbs: verbs as RbacVerb[] };
  });
}

export function rbacProfileRows(setting: RbacSetting): ProfileRow[] {
  const defaults = new Map((setting.deploymentDefault?.additions || []).map((profile) => [profile.key, profile]));
  const effective = new Map((setting.value?.additions || []).map((profile) => [profile.key, profile]));
  const upserts = new Map((setting.overrideValue?.upserts || []).map((profile) => [profile.key, profile]));
  const disabled = new Set(setting.overrideValue?.disabledKeys || []);
  const rows: ProfileRow[] = [];
  for (const [key, profile] of defaults) {
    rows.push({
      profile: disabled.has(key) ? profile : effective.get(key) || profile,
      source: upserts.has(key) ? 'admin_override' : 'deployment',
      disabled: disabled.has(key)
    });
  }
  for (const profile of setting.overrideValue?.upserts || []) {
    if (!defaults.has(profile.key)) rows.push({ profile, source: 'admin', disabled: false });
  }
  return rows;
}

export function rbacProfileAccessVerbs(profile: RbacProfile): RbacVerb[] {
  return RBAC_VERBS.filter((verb) => profile.resources.some((resource) => resource.verbs.includes(verb)));
}

export function KubernetesRbacAdditions({ setting, canMutate, reload, notify }: {
  setting?: RbacSetting;
  canMutate: boolean;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [mutationError, setMutationError] = useState('');
  const rows = useMemo(() => setting ? rbacProfileRows(setting) : [], [setting]);
  if (!setting) return <PageSection title="RBAC Profiles" description="This setting is unavailable."><InlineAlert tone="warning">The deployment did not return this setting.</InlineAlert></PageSection>;
  const editable = canMutate && setting.editable;
  const overlay = setting.overrideValue || emptyOverlay();
  const mutate = async (next: RbacOverlay, reason: string, message: string) => {
    setMutationError('');
    try {
      await adminApi(`/settings/${setting.key}`, {
        method: 'PATCH',
        body: { value: next, expectedVersion: setting.version, reason }
      });
      setDialog(null);
      notify(message);
      await reload();
    } catch (error) {
      const messageText = readableError(error);
      setMutationError(messageText);
      throw new Error(messageText);
    }
  };
  const saveProfile = (profile: RbacProfile, previousKey?: string) => {
    const replacedKey = previousKey || profile.key;
    const upserts = overlay.upserts.filter((item) => item.key !== replacedKey);
    return mutate(
      { upserts: [...upserts, profile], disabledKeys: overlay.disabledKeys.filter((key) => key !== profile.key) },
      `Platform admin ${previousKey ? 'updated' : 'added'} Kubernetes RBAC profile ${profile.key}`,
      `${profile.name} ${previousKey ? 'updated' : 'added'} for future onboarding.`
    );
  };
  const confirmMutation = async () => {
    if (!dialog || dialog.kind === 'add' || dialog.kind === 'edit') return;
    if (dialog.kind === 'reset') {
      try {
        await adminApi(`/settings/${setting.key}`, {
          method: 'DELETE',
          body: { expectedVersion: setting.version, reason: 'Platform admin reset Kubernetes RBAC profiles to the deployment baseline' }
        });
        setDialog(null); notify('RBAC profiles reset to the deployment baseline.'); await reload();
      } catch (error) {
        const messageText = readableError(error);
        setMutationError(messageText);
        throw new Error(messageText);
      }
      return;
    }
    const row = dialog.row!;
    if (dialog.kind === 'disable') {
      await mutate(
        { upserts: overlay.upserts.filter((item) => item.key !== row.profile.key), disabledKeys: [...new Set([...overlay.disabledKeys, row.profile.key])] },
        `Platform admin disabled Kubernetes RBAC profile ${row.profile.key}`,
        `${row.profile.name} disabled for future onboarding.`
      );
    } else if (dialog.kind === 'delete') {
      await mutate(
        { ...overlay, upserts: overlay.upserts.filter((item) => item.key !== row.profile.key) },
        `Platform admin deleted Kubernetes RBAC profile ${row.profile.key}`,
        `${row.profile.name} deleted from future onboarding.`
      );
    } else {
      await mutate(
        { upserts: overlay.upserts.filter((item) => item.key !== row.profile.key), disabledKeys: overlay.disabledKeys.filter((key) => key !== row.profile.key) },
        `Platform admin restored deployment Kubernetes RBAC profile ${row.profile.key}`,
        `${row.profile.name} restored to the deployment definition.`
      );
    }
  };
  const enable = async (row: ProfileRow) => mutate(
    { ...overlay, disabledKeys: overlay.disabledKeys.filter((key) => key !== row.profile.key) },
    `Platform admin enabled deployment Kubernetes RBAC profile ${row.profile.key}`,
    `${row.profile.name} enabled for future onboarding.`
  ).catch(() => undefined);

  return <>
    <PageSection
      title={<span className="flex flex-wrap items-center gap-2">RBAC Profiles <StatusBadge>{rows.filter((row) => !row.disabled).length} available</StatusBadge></span>}
      description={<span className="sm:whitespace-nowrap">Maintain named custom-resource access profiles for future cluster onboarding. Existing clusters are never changed.</span>}
      actions={<div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" disabled={!editable || !setting.overrideValue} onClick={() => setDialog({ kind: 'reset' })}><RotateCcw className="h-4 w-4" />Reset all</Button>
        <Button size="sm" variant="primary" disabled={!editable || setting.value.additions.length >= 25} onClick={() => setDialog({ kind: 'add' })}><Plus className="h-4 w-4" />Add profile</Button>
      </div>}
    >
      {mutationError && <InlineAlert tone="danger" className="mb-4">{mutationError}</InlineAlert>}
      {setting.warning && <InlineAlert tone="warning" className="mb-4">{setting.warning}</InlineAlert>}
      <DataSurface>
        {rows.length ? <DataTableFrame>
          <DataTable caption="Kubernetes RBAC Profiles" className="min-w-[48rem] table-fixed">
            <thead><tr>
              <DataTableHeaderCell density="compact" className="w-[32%]">Profile</DataTableHeaderCell>
              <DataTableHeaderCell density="compact" className="w-[18%]">Source</DataTableHeaderCell>
              <DataTableHeaderCell density="compact" className="w-[14%]">Resources</DataTableHeaderCell>
              <DataTableHeaderCell density="compact" className="w-[24%]">Access</DataTableHeaderCell>
              <DataTableHeaderCell density="compact" className="w-[12%] text-right">Actions</DataTableHeaderCell>
            </tr></thead>
            <tbody>{rows.map((row) => <ProfileTableRow key={row.profile.key} row={row} editable={editable} onDialog={setDialog} onEnable={enable} />)}</tbody>
          </DataTable>
        </DataTableFrame> : <EmptyState embedded icon={<ShieldCheck />} title="No RBAC Profiles" description="Add a profile here or define deployment profiles in Helm values." />}
      </DataSurface>
      {!setting.editable && <HelpText>The deployment has disabled runtime profile changes.</HelpText>}
      {!canMutate && <HelpText>Your platform role has read-only access.</HelpText>}
    </PageSection>
    {(dialog?.kind === 'add' || dialog?.kind === 'edit') && <ProfileEditor
      existingKeys={[...rows.map((row) => row.profile.key), ...overlay.disabledKeys]}
      profile={dialog.kind === 'edit' ? dialog.row.profile : undefined}
      onClose={() => setDialog(null)}
      onSave={(profile) => saveProfile(profile, dialog.kind === 'edit' ? dialog.row.profile.key : undefined)}
    />}
    {dialog && ['disable', 'delete', 'restore', 'reset'].includes(dialog.kind) && <ConfirmProfileMutation
      dialog={dialog as Exclude<DialogState, null | { kind: 'add' } | { kind: 'edit'; row: ProfileRow }>}
      error={mutationError}
      onClose={() => setDialog(null)}
      onConfirm={confirmMutation}
    />}
  </>;
}

function ProfileTableRow({ row, editable, onDialog, onEnable }: {
  row: ProfileRow;
  editable: boolean;
  onDialog: (dialog: DialogState) => void;
  onEnable: (row: ProfileRow) => Promise<void>;
}) {
  const access = rbacProfileAccessVerbs(row.profile);
  const sourceLabel = row.source === 'deployment' ? 'Deployment' : row.source === 'admin_override' ? 'Admin override' : 'Admin';
  return <tr className="data-row" aria-disabled={row.disabled || undefined}>
    <td data-primary="true" data-label="Profile" className="px-5 py-4">
      <div className={row.disabled ? 'opacity-60' : ''}><strong className="block text-sm text-ui-text">{row.profile.name}</strong><span className="mono block text-xs text-ui-text-muted">{row.profile.key}</span>{row.profile.description && <span className="mt-1 block text-xs leading-5 text-ui-text-muted">{row.profile.description}</span>}</div>
    </td>
    <td data-label="Source" className="px-5 py-4"><div className="flex flex-wrap gap-1"><StatusBadge>{sourceLabel}</StatusBadge>{row.disabled && <StatusBadge tone="neutral">Disabled</StatusBadge>}</div></td>
    <td data-label="Resources" className="px-5 py-4 text-sm text-ui-text">{row.profile.resources.length}</td>
    <td data-label="Access" className="px-5 py-4"><div className="flex flex-wrap gap-1">{access.map((verb) => <StatusBadge key={verb}>{verb}</StatusBadge>)}</div></td>
    <td data-label="Actions" className="px-5 py-4"><div className="responsive-actions flex justify-end"><OverflowActionMenu label={`Actions for ${row.profile.name}`} disabled={!editable}>{(close) => row.disabled ? <MenuItem onClick={() => { close(); void onEnable(row); }}><Undo2 className="h-4 w-4 text-ui-text-muted" />Enable</MenuItem> : <>
      <MenuItem onClick={() => { close(); onDialog({ kind: 'edit', row }); }}><Pencil className="h-4 w-4 text-ui-text-muted" />Edit</MenuItem>
      {row.source === 'admin_override' && <MenuItem onClick={() => { close(); onDialog({ kind: 'restore', row }); }}><RotateCcw className="h-4 w-4 text-ui-text-muted" />Restore deployment version</MenuItem>}
      <MenuItem destructive onClick={() => { close(); onDialog({ kind: row.source === 'admin' ? 'delete' : 'disable', row }); }}><Trash2 className="h-4 w-4" />{row.source === 'admin' ? 'Delete' : 'Disable'}</MenuItem>
    </>}</OverflowActionMenu></div></td>
  </tr>;
}

function ProfileEditor({ profile, existingKeys, onClose, onSave }: {
  profile?: RbacProfile;
  existingKeys: string[];
  onClose: () => void;
  onSave: (profile: RbacProfile) => Promise<void>;
}) {
  const [name, setName] = useState(profile?.name || '');
  const [key, setKey] = useState(profile?.key || '');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState(profile?.description || '');
  const [yaml, setYaml] = useState(stringify({ resources: profile?.resources || exampleResources.resources }));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => { if (!profile && !keyTouched) setKey(normalizeRbacProfileKey(name)); }, [keyTouched, name, profile]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    try {
      const normalizedKey = normalizeRbacProfileKey(key);
      if (!name.trim() || name.trim().length > 80) throw new Error('Name must contain between 1 and 80 characters.');
      if (!normalizedKey || normalizedKey !== key || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key)) throw new Error('Key must use lowercase letters, numbers, and single hyphens.');
      if (!profile && existingKeys.includes(key)) throw new Error('A profile with this key already exists.');
      if (description.length > 240) throw new Error('Description must contain no more than 240 characters.');
      const resources = parseRbacResourcesYaml(yaml);
      setPending(true);
      await onSave({ key, name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), resources });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The profile is invalid.');
    } finally { setPending(false); }
  };
  return <ActionDialog title={profile ? `Edit ${profile.name}` : 'Add RBAC Profile'} description="Define one user-facing profile and its exact Kubernetes custom-resource rules." submitLabel={profile ? 'Save profile' : 'Add profile'} pendingLabel="Saving…" pending={pending} error={error} onClose={onClose} onSubmit={submit}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><FieldLabel>Name</FieldLabel><TextInput className="mt-2" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="CloudNativePG" /></div>
      <div><FieldLabel>Key</FieldLabel><TextInput className="mono mt-2" value={key} maxLength={64} disabled={Boolean(profile)} onChange={(event) => { setKeyTouched(true); setKey(normalizeRbacProfileKey(event.target.value)); }} placeholder="cnpg" /></div>
    </div>
    <div><FieldLabel>Description</FieldLabel><TextInput className="mt-2" value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} placeholder="CloudNativePG database clusters" /></div>
    <div><FieldLabel>Resource Rules YAML</FieldLabel><Textarea aria-label="Resource Rules YAML" spellCheck={false} rows={14} className="mono mt-2 text-xs" value={yaml} onChange={(event) => setYaml(event.target.value)} /><HelpText>Use exact API groups, versions, plural resources, kinds, scopes, and supported verbs. Wildcards and unknown fields are rejected.</HelpText></div>
  </ActionDialog>;
}

function ConfirmProfileMutation({ dialog, error, onClose, onConfirm }: {
  dialog: { kind: 'disable' | 'delete' | 'restore' | 'reset'; row?: ProfileRow };
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const name = dialog.row?.profile.name;
  const copy = dialog.kind === 'reset'
    ? { title: 'Reset RBAC Profiles', description: 'Remove all admin additions, overrides, and disabled-profile choices. The deployment baseline will become the future-onboarding catalog.', label: 'Reset all', danger: true }
    : dialog.kind === 'restore'
      ? { title: 'Restore Deployment Profile', description: `Replace the admin override for ${name} with its deployment definition. Existing clusters remain unchanged.`, label: 'Restore', danger: false }
      : dialog.kind === 'disable'
        ? { title: 'Disable RBAC Profile', description: `Remove ${name} from future cluster onboarding. Existing clusters remain unchanged.`, label: 'Disable', danger: true }
        : { title: 'Delete RBAC Profile', description: `Delete ${name} from future cluster onboarding. Existing clusters remain unchanged.`, label: 'Delete', danger: true };
  return <ActionDialog title={copy.title} description={copy.description} submitLabel={copy.label} pending={pending} danger={copy.danger} error={error} onClose={onClose} onSubmit={async (event) => { event.preventDefault(); setPending(true); try { await onConfirm(); } catch { /* The parent exposes the projected API error. */ } finally { setPending(false); } }} />;
}
