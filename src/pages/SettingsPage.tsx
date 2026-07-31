import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  FieldLabel,
  HelpText,
  InlineAlert,
  LoadingState,
  PageHeader,
  PageSection,
  Select,
  StatusBadge,
  TextInput
} from '@acornops/ui';
import { adminApi, readableError } from '../api';
import type { PageProps } from '../app-types';
import { titleCase } from '../lib';

const providers = ['openai', 'anthropic', 'gemini'] as const;
const providerLabels: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini' };
const discoveryLabels: Record<string, string> = { disabled: 'By Invites Only', exact_email: 'Exact Email', directory: 'Directory' };

export function settingValuesMatch(left: unknown, right: unknown) {
  const normalize = (value: any): any => Array.isArray(value)
    ? value.map(normalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]))
      : value;
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function aiPolicyMutationValue(value: any) {
  const providerModels = Object.fromEntries(providers.map((provider) => [
    provider,
    Array.isArray(value?.providerModels?.[provider]) ? [...value.providerModels[provider]] : []
  ]));
  const defaultProvider = providers.includes(value?.defaultProvider) ? value.defaultProvider : '';
  const selectedModels = providerModels[defaultProvider] || [];
  const defaultModel = selectedModels.includes(value?.defaultModel)
    ? value.defaultModel
    : selectedModels[0] || '';
  const reasoningSummariesEnabled = value?.reasoningSummariesEnabled === true;

  return {
    defaultProvider,
    defaultModel,
    providerModels,
    reasoningSummariesEnabled,
    reasoningSummaryModes: reasoningSummariesEnabled
      ? [...(value?.reasoningSummaryModes || [])]
      : ['off'],
    reasoningEfforts: [...(value?.reasoningEfforts || [])]
  };
}

export function isAiPolicyMutationValid(value: ReturnType<typeof aiPolicyMutationValue>) {
  return Boolean(
    value.defaultProvider
    && value.defaultModel
    && value.providerModels[value.defaultProvider]?.includes(value.defaultModel)
    && value.reasoningSummaryModes.length
    && value.reasoningEfforts.length
  );
}

export function SettingsPage({ category, canMutate, notify }: PageProps & { category: 'workspace' | 'ai' }) {
  const [settings, setSettings] = useState<Map<string, any> | null>(null);
  const [providerDefaults, setProviderDefaults] = useState<any[] | null>(category === 'ai' ? null : []);
  const [error, setError] = useState('');
  const [providerError, setProviderError] = useState('');
  const load = useCallback(async () => {
    setError(''); setProviderError('');
    try {
      const response = await adminApi<any>('/settings');
      setSettings(new Map((response.items || []).map((setting: any) => [setting.key, setting])));
      if (category === 'ai') {
        try {
          const defaults = await adminApi<any>('/llm-provider-defaults');
          setProviderDefaults(defaults.providers || []);
        } catch (reason) {
          setProviderDefaults(null);
          setProviderError(readableError(reason));
        }
      }
    } catch (reason) { setError(readableError(reason)); }
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  const title = category === 'workspace' ? 'Workspace Settings' : 'AI Providers';
  const description = category === 'workspace' ? 'Manage workspace access and sign-in defaults.' : 'Manage default AI provider keys and policy.';
  if (!settings && !error) return <><PageHeader title={title} description={description} /><Card><LoadingState label={`Loading ${title}`} /></Card></>;
  if (error) return <><PageHeader title={title} description={description} /><InlineAlert tone="danger">{error}</InlineAlert></>;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title={title} description={description} />
      {category === 'workspace' ? (
        <div className="space-y-10">
          <MemberDiscovery setting={settings!.get('member_discovery')} canMutate={canMutate} reload={load} notify={notify} />
          <SignInMethods setting={settings!.get('user_sign_in_methods')} canMutate={canMutate} reload={load} notify={notify} />
        </div>
      ) : (
        <div className="space-y-10">
          <ProviderDefaults values={providerDefaults} error={providerError} canMutate={canMutate} reload={load} notify={notify} />
          <AiPolicy setting={settings!.get('ai_policy')} canMutate={canMutate} reload={load} notify={notify} />
        </div>
      )}
    </div>
  );
}

function SettingFrame({ setting, title, description, value, saveDisabled = false, canMutate, reload, notify, children }: any) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!setting) return <PageSection title={title} description="This setting is unavailable."><InlineAlert tone="warning">The deployment did not return this setting.</InlineAlert></PageSection>;
  const editable = canMutate && setting.editable;
  const dirty = !settingValuesMatch(value, setting.value);
  const mutate = async (method: 'PATCH' | 'DELETE') => {
    setPending(true); setError('');
    try {
      await adminApi(`/settings/${encodeURIComponent(setting.key)}`, {
        method,
        body: method === 'PATCH'
          ? { value, expectedVersion: setting.version, reason: `Platform admin updated ${setting.key.replaceAll('_', ' ')}` }
          : { expectedVersion: setting.version, reason: `Platform admin reset ${setting.key.replaceAll('_', ' ')} to the deployment default` }
      });
      notify(`${title} ${method === 'PATCH' ? 'updated' : 'reset to deployment default'}.`);
      await reload();
    } catch (reason) { setError(readableError(reason)); } finally { setPending(false); }
  };
  return (
    <PageSection
      title={<span className="flex flex-wrap items-center gap-2">{title}<StatusBadge>{setting.source === 'runtime_override' ? 'Admin Override' : setting.source === 'runtime_override_constrained' ? 'Policy Constrained' : 'Deployment Default'}</StatusBadge></span>}
      description={description}
      actions={<><Button size="sm" disabled={!editable || setting.overrideValue === undefined || pending} onClick={() => void mutate('DELETE')}>Reset</Button><Button variant="primary" size="sm" disabled={!editable || !dirty || saveDisabled || pending} onClick={() => void mutate('PATCH')}>{pending ? 'Saving…' : 'Save'}</Button></>}
    >
      <Card className="p-5">
        <div className={!editable ? 'pointer-events-none opacity-65' : ''}>{children}</div>
        {setting.warning && <InlineAlert tone="warning" className="mt-4"><strong>Deployment policy applied.</strong> {setting.warning}</InlineAlert>}
        {!setting.editable && <HelpText>This value is fixed by deployment policy.</HelpText>}
        {!canMutate && <HelpText>Your platform role has read-only access.</HelpText>}
        {error && <InlineAlert tone="danger" className="mt-4">{error}</InlineAlert>}
      </Card>
    </PageSection>
  );
}

function MemberDiscovery(props: any) {
  const setting = props.setting;
  const [mode, setMode] = useState(setting?.value?.mode || 'disabled');
  useEffect(() => setMode(setting?.value?.mode || 'disabled'), [setting]);
  const notes: Record<string, string> = {
    directory: 'Workspace owners can search the user directory and add an existing user directly. Access is granted as soon as they add the user.',
    exact_email: 'Workspace owners can add an existing user by entering their exact email address. Access is granted as soon as they add the user.',
    disabled: 'Workspace owners can only send invitation links. The invited person is added after they accept the invitation.'
  };
  return <SettingFrame {...props} title="Member Discovery" description="Controls how workspace owners add people to their workspace." value={{ mode }}>
    <FieldLabel>Discovery mode</FieldLabel>
    <Select value={mode} onChange={setMode} className="mt-2 max-w-sm" options={(setting?.constraints?.allowedModes || []).map((value: string) => ({ value, label: discoveryLabels[value] || value }))} />
    <HelpText>{notes[mode]}</HelpText>
  </SettingFrame>;
}

function SignInMethods(props: any) {
  const setting = props.setting;
  const [methods, setMethods] = useState<string[]>(setting?.value?.methods || []);
  useEffect(() => setMethods(setting?.value?.methods || []), [setting]);
  const toggle = (method: string) => setMethods((current) => current.includes(method) ? (current.length === 1 ? current : current.filter((value) => value !== method)) : [...current, method]);
  return <SettingFrame {...props} title="User Sign-In Methods" description="Choose how workspace users can sign in. Select at least one method." value={{ methods }}>
    <fieldset>
      <legend className="text-xs font-semibold text-ui-text-muted">Allowed Sign-In Methods</legend>
      <div className="mt-4 space-y-4">
        {[
          { key: 'password', label: 'Password', description: 'Lets users sign in with a password. New users are prompted to create one the first time they sign in.' },
          { key: 'oidc', label: 'OIDC', description: 'Redirects users to the configured OpenID Connect identity provider to sign in.' }
        ].map((method) => {
          const allowed = setting?.constraints?.allowedMethods?.includes(method.key);
          return <label key={method.key} className="flex items-start gap-3">
            <Checkbox checked={methods.includes(method.key)} disabled={!allowed} onChange={() => toggle(method.key)} />
            <span><strong className="block text-sm text-ui-text">{method.label}</strong><small className="block text-xs leading-5 text-ui-text-muted">{method.description}</small>{setting?.constraints?.methodBlockers?.[method.key]?.[0] && <small className="block text-xs text-accent-readable">{setting.constraints.methodBlockers[method.key][0]}</small>}</span>
          </label>;
        })}
      </div>
    </fieldset>
  </SettingFrame>;
}

function ProviderDefaults({ values, error, canMutate, reload, notify }: any) {
  const byProvider = new Map((values || []).map((status: any) => [status.provider, status]));
  return <PageSection title={<span className="flex items-center gap-2">Default LLM Keys <StatusBadge>Write-Only</StatusBadge></span>} description="Used by every workspace unless that workspace saves its own provider key.">
    {values === null ? <InlineAlert tone="danger"><strong>Default LLM key status is temporarily unavailable.</strong> {error} <Button size="sm" className="ml-2" onClick={() => void reload()}>Retry</Button></InlineAlert> : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => <ProviderCard key={provider} provider={provider} status={byProvider.get(provider) || { configured: false, enabled: false }} canMutate={canMutate} reload={reload} notify={notify} />)}
      </div>
    )}
  </PageSection>;
}

function ProviderCard({ provider, status, canMutate, reload, notify }: any) {
  const [apiKey, setApiKey] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const mutate = async (method: 'PUT' | 'DELETE') => {
    setPending(true); setError('');
    try {
      await adminApi(`/llm-provider-defaults/${provider}`, { method, body: method === 'PUT' ? { apiKey: apiKey.trim(), reason: `Platform admin updated the ${provider} default LLM key` } : { reason: `Platform admin deleted the ${provider} default LLM key` } });
      setApiKey(''); setConfirmDelete(false);
      notify(`${providerLabels[provider]} default key ${method === 'PUT' ? 'updated' : 'deleted'}.`);
      await reload();
    } catch (reason) { setError(readableError(reason)); setApiKey(''); } finally { setPending(false); }
  };
  return <Card className="flex min-h-64 flex-col p-4">
    <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ui-text">{providerLabels[provider]}</strong><StatusBadge tone={status.configured ? 'success' : 'neutral'}>{status.configured ? 'Configured' : 'Not configured'}</StatusBadge></div>
    {!status.enabled && <HelpText>Disabled by deployment policy.</HelpText>}
    <div className="mt-5"><FieldLabel>{status.configured ? 'Rotate API key' : 'Add API key'}</FieldLabel><TextInput type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={`Paste ${providerLabels[provider]} key`} disabled={!canMutate || !status.enabled || pending} className="mt-2" /></div>
    <div className="mt-auto flex flex-wrap justify-end gap-2 pt-5">
      <Button size="sm" disabled={!apiKey.trim() || pending || !canMutate || !status.enabled} onClick={() => void mutate('PUT')}><CheckCircle2 className="h-4 w-4" /> {status.configured ? 'Rotate key' : 'Save key'}</Button>
      {status.configured && <Button variant="danger" size="sm" disabled={!canMutate || pending} onClick={() => confirmDelete ? void mutate('DELETE') : setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> {confirmDelete ? 'Confirm delete' : 'Delete key'}</Button>}
    </div>
    {error && <p className="mt-3 text-xs text-status-danger-text" role="alert">{error}</p>}
  </Card>;
}

function AiPolicy(props: any) {
  const setting = props.setting;
  const [value, setValue] = useState<any>(setting?.value || {});
  useEffect(() => setValue(setting?.value || {}), [setting]);
  const ceiling = setting?.constraints || {};
  const models = ceiling.providerModels || {};
  const availableProviders = providers.filter((provider) => (models[provider] || []).length);
  const mutationValue = aiPolicyMutationValue(value);
  const toggleModel = (provider: string, model: string) => setValue((current: any) => {
    const selected = current.providerModels?.[provider] || [];
    const next = selected.includes(model) ? (selected.length === 1 ? selected : selected.filter((item: string) => item !== model)) : [...selected, model];
    const defaultModel = provider === current.defaultProvider && !next.includes(current.defaultModel) ? next[0] : current.defaultModel;
    return { ...current, defaultModel, providerModels: { ...current.providerModels, [provider]: next } };
  });
  const toggleList = (key: string, item: string) => setValue((current: any) => {
    const selected = current[key] || [];
    const next = selected.includes(item) ? (selected.length === 1 ? selected : selected.filter((value: string) => value !== item)) : [...selected, item];
    return { ...current, [key]: next };
  });
  return <SettingFrame {...props} title="AI Policy" description="Limits workspace provider, model, and reasoning choices." value={mutationValue} saveDisabled={!isAiPolicyMutationValid(mutationValue)}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><FieldLabel>Default provider</FieldLabel><Select value={value.defaultProvider || ''} onChange={(provider) => setValue((current: any) => ({ ...current, defaultProvider: provider, defaultModel: current.providerModels?.[provider]?.[0] || models[provider]?.[0] || '' }))} className="mt-2" options={availableProviders.map((provider) => ({ value: provider, label: providerLabels[provider] }))} /></div>
      <div><FieldLabel>Default model</FieldLabel><Select value={value.defaultModel || ''} onChange={(defaultModel) => setValue((current: any) => ({ ...current, defaultModel }))} className="mt-2" options={(value.providerModels?.[value.defaultProvider] || []).map((model: string) => ({ value: model, label: model }))} /></div>
    </div>
    <fieldset className="mt-6"><legend className="text-sm font-semibold text-ui-text">Available Models</legend><div className="mt-3 grid gap-4 sm:grid-cols-3">{availableProviders.map((provider) => <div key={provider}><strong className="text-xs text-ui-text-muted">{providerLabels[provider]}</strong><div className="mt-2 space-y-2">{models[provider].map((model: string) => <label className="flex items-center gap-2 text-sm text-ui-text" key={model}><Checkbox checked={value.providerModels?.[provider]?.includes(model) || false} onChange={() => toggleModel(provider, model)} />{model}</label>)}</div></div>)}</div></fieldset>
    <fieldset className="mt-6"><legend className="text-sm font-semibold text-ui-text">Reasoning</legend>
      {ceiling.reasoningSummariesEnabled ? <label className="mt-3 flex items-center gap-2 text-sm text-ui-text"><Checkbox checked={Boolean(value.reasoningSummariesEnabled)} onChange={(event) => setValue((current: any) => ({ ...current, reasoningSummariesEnabled: event.target.checked, reasoningSummaryModes: event.target.checked ? current.reasoningSummaryModes : ['off'] }))} />Reasoning summaries</label> : <HelpText>Reasoning summaries are disabled by deployment policy.</HelpText>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ChoiceGroup label="Summary Modes" values={ceiling.reasoningSummaryModes || []} selected={value.reasoningSummaryModes || []} onToggle={(item: string) => toggleList('reasoningSummaryModes', item)} />
        <ChoiceGroup label="Reasoning Effort" values={ceiling.reasoningEfforts || []} selected={value.reasoningEfforts || []} onToggle={(item: string) => toggleList('reasoningEfforts', item)} />
      </div>
    </fieldset>
  </SettingFrame>;
}

function ChoiceGroup({ label, values, selected, onToggle }: any) {
  return <div><strong className="text-xs text-ui-text-muted">{label}</strong><div className="mt-2 space-y-2">{values.map((value: string) => <label key={value} className="flex items-center gap-2 text-sm text-ui-text"><Checkbox checked={selected.includes(value)} onChange={() => onToggle(value)} />{titleCase(value)}</label>)}</div></div>;
}
