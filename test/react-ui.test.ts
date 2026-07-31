import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getBoundaryEnabledOptionIndex,
  getNextEnabledOptionIndex,
  getOverlayFocusWrapIndex,
  shouldCloseOverlayOnKeyDown
} from '@acornops/ui';
import { AdminApiError, adminLoginPath, readableError } from '../src/api';
import { administratorInitials, formatDateOnly, formatMembershipLifecycle, resolveRoute } from '../src/lib';
import { buildOverviewModel } from '../src/pages/OverviewPage';
import { filterUsersByWorkspace } from '../src/pages/UsersPage';
import {
  aiPolicyMutationValue,
  isAiPolicyMutationValid,
  settingValuesMatch
} from '../src/pages/SettingsPage';
import { buildManualSkillContent, canonicalDestinations, normalizeSkillName } from '../src/pages/WorkspaceDefaultsPage';
import {
  auditActorName,
  auditAffectedParts,
  auditAffectedText,
  auditEventText,
  auditPresetRange,
  buildAuditQuery,
  humanizeAuditAction,
  rawAuditKeyValues
} from '../src/pages/AuditPage';

test('resolves every platform route without a client routing dependency', () => {
  assert.deepEqual(resolveRoute('/'), { name: 'overview', path: '/' });
  assert.deepEqual(resolveRoute('/workspaces/ws-1'), { name: 'workspaces', path: '/workspaces/ws-1', resourceId: 'ws-1' });
  assert.equal(resolveRoute('/settings').name, 'settings-workspace');
  assert.equal(resolveRoute('/settings/ai').name, 'settings-ai');
  assert.equal(resolveRoute('/workspace-defaults').name, 'workspace-defaults');
  assert.equal(resolveRoute('/audit').name, 'audit');
});

test('builds stable administrator initials', () => {
  assert.equal(administratorInitials({ displayName: 'Ada Lovelace' }), 'AL');
  assert.equal(administratorInitials({ email: 'avery@example.test' }), 'AE');
  assert.equal(administratorInitials({ subject: 'platform-admin-42' }), 'PA');
  assert.equal(administratorInitials(null), 'PA');
  assert.equal(administratorInitials(), 'PA');
});

test('formats membership lifecycle metadata without a timestamp', () => {
  const formatted = formatDateOnly('2026-07-31T03:45:00Z');
  assert.match(formatted, /2026/);
  assert.doesNotMatch(formatted, /\d{1,2}:\d{2}/);
});

test('shows an updated membership date only after the permission changes', () => {
  const createdAt = '2026-07-31T03:45:00Z';
  const unchanged = formatMembershipLifecycle(createdAt, createdAt);
  const updatedOnSameDay = formatMembershipLifecycle(createdAt, '2026-07-31T05:10:00Z');

  assert.match(unchanged, /^Added /);
  assert.doesNotMatch(unchanged, /Updated/);
  assert.match(updatedOnSameDay, /^Added .+ · Updated /);
  assert.doesNotMatch(updatedOnSameDay, /\d{1,2}:\d{2}/);
});

test('preserves ordinary sign-in and recent-auth redirect paths', () => {
  assert.equal(
    adminLoginPath(401, 'UNAUTHENTICATED', '/users?workspace=Alpha'),
    '/admin-auth/oidc/login?return_to=%2Fusers%3Fworkspace%3DAlpha'
  );
  assert.equal(
    adminLoginPath(403, 'ADMIN_REAUTH_REQUIRED', '/settings/ai'),
    '/admin-auth/oidc/login?reauthenticate=true&return_to=%2Fsettings%2Fai'
  );
  assert.equal(adminLoginPath(403, 'FORBIDDEN', '/'), '');
});

test('translates last-owner producer errors into actionable workspace copy', () => {
  assert.equal(
    readableError(new AdminApiError('replacementOwnerUserId is required to remove the last owner', 'LAST_OWNER', 409)),
    'Workspace must keep at least one owner'
  );
  assert.equal(readableError(new AdminApiError('User already has access', 'MEMBERSHIP_EXISTS', 409)), 'User already has access');
});

test('shared controls retain management-console keyboard and focus wrapping behavior', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B', disabled: true },
    { value: 'c', label: 'C' }
  ];
  assert.equal(getBoundaryEnabledOptionIndex(options), 0);
  assert.equal(getBoundaryEnabledOptionIndex(options, 'last'), 2);
  assert.equal(getNextEnabledOptionIndex(options, 0, 1), 2);
  assert.equal(getNextEnabledOptionIndex(options, 2, 1), 0);
  assert.equal(getOverlayFocusWrapIndex({ currentIndex: 2, focusableCount: 3, shiftKey: false }), 0);
  assert.equal(getOverlayFocusWrapIndex({ currentIndex: 0, focusableCount: 3, shiftKey: true }), 2);
  assert.equal(shouldCloseOverlayOnKeyDown('Escape'), true);
  assert.equal(shouldCloseOverlayOnKeyDown('Escape', true), false);
});

test('overview model remains governance-safe and contract-backed', () => {
  const model = buildOverviewModel({
    workspaces: [
      { id: 'b', name: 'Beta', clusterCount: 2, virtualMachineCount: 1, lifecycleStatus: 'active' },
      { id: 'a', name: 'Alpha', clusterCount: 1, virtualMachineCount: 0, lifecycleStatus: 'suspended' }
    ],
    users: [{ emailVerified: true }, { emailVerified: false }]
  });
  assert.equal(model.environmentCount, 4);
  assert.equal(model.environmentLeaders[0].name, 'Beta');
  assert.equal(model.suspendedWorkspaceCount, 1);
  assert.equal(model.verifiedPercent, 50);
});

test('workspace filtering uses both workspace name and immutable id', () => {
  const users = [{ id: 'u1' }, { id: 'u2' }];
  const access = new Map([['u1', new Set(['ws-a'])], ['u2', new Set(['ws-b'])]]);
  const workspaces = [{ id: 'ws-a', name: 'Alpha' }, { id: 'ws-b', name: 'Beta' }];
  assert.deepEqual(filterUsersByWorkspace(users, access, workspaces, 'alpha'), [users[0]]);
  assert.deepEqual(filterUsersByWorkspace(users, access, workspaces, 'ws-b'), [users[1]]);
});

test('setting comparison is order-insensitive for policy arrays', () => {
  assert.equal(settingValuesMatch({ methods: ['oidc', 'password'] }, { methods: ['password', 'oidc'] }), true);
  assert.equal(settingValuesMatch({ methods: ['oidc'] }, { methods: ['password'] }), false);
});

test('AI policy mutations preserve the legacy validation and summary normalization', () => {
  const normalized = aiPolicyMutationValue({
    defaultProvider: 'openai',
    defaultModel: 'gpt-5.5',
    providerModels: { openai: ['gpt-5.5'], anthropic: [], gemini: [] },
    reasoningSummariesEnabled: false,
    reasoningSummaryModes: ['auto'],
    reasoningEfforts: ['high']
  });
  assert.deepEqual(normalized.reasoningSummaryModes, ['off']);
  assert.equal(isAiPolicyMutationValid(normalized), true);

  const invalid = aiPolicyMutationValue({
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-6',
    providerModels: { openai: ['gpt-5.5'], anthropic: [], gemini: [] },
    reasoningSummariesEnabled: true,
    reasoningSummaryModes: ['auto'],
    reasoningEfforts: ['high']
  });
  assert.equal(invalid.defaultModel, '');
  assert.equal(isAiPolicyMutationValid(invalid), false);
});

test('capability destinations are canonical and bounded', () => {
  assert.deepEqual(canonicalDestinations('all'), ['agents', 'kubernetes', 'virtual_machines']);
  assert.deepEqual(canonicalDestinations(['virtual_machines', 'agents', 'unknown']), ['agents', 'virtual_machines']);
});

test('manual skill templates follow the management-console skill format', () => {
  assert.equal(normalizeSkillName(' Incident Triage '), 'incident-triage');
  assert.equal(
    buildManualSkillContent('Incident Triage', 'Use for incidents: urgent', '## Guidance\n\nInvestigate safely.'),
    '---\nname: incident-triage\ndescription: "Use for incidents: urgent"\n---\n\n## Guidance\n\nInvestigate safely.\n'
  );
  assert.match(buildManualSkillContent('Troubleshooting CNPG'), /^---\nname: troubleshooting-cnpg\ndescription: "Describe when this troubleshooting skill should be applied\."\n---\n\n## Purpose/);
  assert.match(buildManualSkillContent('Troubleshooting CNPG'), /## Guidance\n\n- Add the primary investigation steps\./);
});

test('audit filters and privacy-safe readable values remain stable', () => {
  const query = buildAuditQuery({ workspaceQuery: 'Atlas Research', outcome: 'success', ignored: '' }, '2026-07-01T00:00', '2026-07-02T00:00');
  assert.equal(query.get('workspaceQuery'), 'Atlas Research');
  assert.equal(query.get('outcome'), 'success');
  assert.match(query.get('from') || '', /^2026-06-30T|^2026-07-01T/);
  const range = auditPresetRange('24h', new Date('2026-07-29T12:00:00Z'));
  assert.equal(range.now.getTime() - range.from.getTime(), 86_400_000);
  const event = {
    action: 'admin.workspace.plan.update',
    workspaceId: 'ws-1',
    workspaceName: 'Alpha',
    adminActorDisplayName: 'Admin User',
    metadata: { correlationId: 'req-1', ticketRef: 'private' }
  };
  assert.equal(auditActorName(event), 'Admin User');
  assert.equal(auditAffectedText(event), 'Workspace Alpha');
  assert.deepEqual(auditAffectedParts({ ...event, subjectType: 'user', subjectId: 'usr_noor', subjectDisplayName: 'Noor Patel' }), [
    { label: 'Workspace', value: 'Alpha' },
    { label: 'User', value: 'Noor Patel' }
  ]);
  assert.deepEqual(auditAffectedParts({ subjectType: 'user', subjectId: 'usr_missing' }), [
    { label: 'User', value: 'Unknown user' }
  ]);
  assert.equal(auditEventText({
    action: 'admin.workspace.member.add.request',
    workspaceName: 'Development Workspace',
    reason: 'Platform admin granted Owner access to Development Workspace'
  }), 'Granted Owner access to Development Workspace');
  assert.equal(auditEventText({
    action: 'admin.workspace.member.role.update',
    workspaceName: 'Development Workspace',
    subjectDisplayName: 'Noor Patel',
    metadata: { nextRole: 'owner' }
  }), "Changed Noor Patel's role to Owner in Development Workspace");
  assert.equal(auditEventText({
    action: 'admin.workspace.member.delete',
    workspaceName: 'Local QA Sandbox 20260731-111221',
    subjectDisplayName: 'Dev User'
  }), "Revoked Dev User's access to Local QA Sandbox 20260731-111221");
  assert.equal(auditEventText({
    action: 'admin.workspace.suspend',
    workspaceName: 'Development Workspace'
  }), 'Suspended Development Workspace');
  assert.equal(humanizeAuditAction('admin.workspace.member.delete.request'), 'Admin · Workspace · Member · Delete · Request');
  assert.match(rawAuditKeyValues(event), /correlationId: req-1/);
  assert.doesNotMatch(rawAuditKeyValues(event), /ticketRef/);
});

test('browser source uses React, Tailwind, and the replicated shared package', async () => {
  const [packageJson, app, styles, uiPackage, uiIndex, button, select, dialog, panel, modalIsolation, index, themeInit] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/Button.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/Select.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/Dialog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/RightSidePanel.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/ModalIsolation.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/theme-init.ts', import.meta.url), 'utf8')
  ]);
  assert.match(packageJson, /"react": "\^19\.2\.4"/);
  assert.match(packageJson, /"@acornops\/ui": "workspace:\*"/);
  assert.match(app, /from '@acornops\/ui'/);
  assert.match(app, /lucide-react/);
  assert.match(styles, /@tailwind base/);
  assert.match(uiPackage, /AcornOps shared React component system/);
  assert.match(uiIndex, /export \* from '\.\/Button'/);
  assert.match(button, /export const Button/);
  assert.match(select, /export const Select/);
  assert.match(dialog, /z-\[120\].*items-end justify-center.*sm:items-center/);
  assert.match(panel, /z-\[100\].*justify-end/);
  assert.match(modalIsolation, /event\.key !== 'Tab'/);
  await assert.rejects(readFile(new URL('../packages/ui/src/index.tsx', import.meta.url), 'utf8'), { code: 'ENOENT' });
  assert.match(index, /src\/theme-init\.ts/);
  assert.match(themeInit, /document\.documentElement\.classList\.toggle\('dark'/);
  assert.match(themeInit, /localStorage\.getItem\(themeStorageKey\)/);
});

test('the production sign-in fallback has no legacy font route dependency', async () => {
  const styles = await readFile(new URL('../public/auth-unavailable.css', import.meta.url), 'utf8');
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(styles, /\/fonts\//);
  assert.doesNotMatch(server, /\/fonts\//);
  assert.match(styles, /font-family: system-ui, sans-serif/);
});

test('account menu keeps the three appearance choices and accessible menu behavior', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /aria-haspopup="menu"/);
  assert.match(app, /role="menu" aria-label="Account"/);
  assert.equal((app.match(/role="menuitemradio"/g) || []).length, 1);
  assert.match(app, /\['system', 'light', 'dark'\] as ThemePreference\[\]/);
  assert.match(app, /document\.addEventListener\('mousedown', handlePointerDown, true\)/);
  assert.match(app, /event\.key !== 'Escape'/);
  assert.match(app, /Logging out…/);
  assert.doesNotMatch(app, /Account Settings|password/i);
});

test('navigation uses the accepted panel icon for both workspace destinations', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /\{ label: 'Workspaces', path: '\/workspaces', route: 'workspaces', icon: PanelsTopLeft \}/);
  assert.match(app, /\{ label: 'Workspace', path: '\/settings\/workspace', route: 'settings-workspace', icon: PanelsTopLeft \}/);
  assert.doesNotMatch(app, /createLucideIcon\('Workspaces?'/);
  assert.doesNotMatch(app, /icon: (?:Building2|Grid2X2|Square|SquareStack)/);
});

test('capability defaults reuse the management underline tabs without adding Tools', async () => {
  const [page, compactControls, formControls, modalSteps, overflowMenu, styles] = await Promise.all([
    readFile(new URL('../src/pages/WorkspaceDefaultsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/CompactControls.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/FormControls.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/ModalStepIndicator.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/OverflowActionMenu.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  ]);
  assert.match(compactControls, /export const SegmentedTabs/);
  assert.match(compactControls, /flex gap-2 overflow-x-auto border-b border-ui-border/);
  assert.match(compactControls, /\{tab\.isActive && <ActiveTabIndicator \/>\}/);
  assert.match(page, /<SegmentedTabs/);
  assert.match(page, /allPanelsMounted=\{false\}/);
  assert.match(page, /\{ value: 'mcp', label: 'MCP servers' \}/);
  assert.match(page, /\{ value: 'skills', label: 'Skills' \}/);
  assert.match(page, /role="tabpanel"/);
  assert.doesNotMatch(page, /label: 'Tools'/);
  assert.doesNotMatch(page, /inline-flex rounded-md border border-ui-border bg-ui-surface p-1/);
  assert.match(page, /toolbarFullWidth/);
  assert.match(page, /sm:grid-cols-\[minmax\(0,1fr\)_12rem_auto\]/);
  assert.match(page, /<PageHeader title="Capabilities" description="New workspaces are created with these defaults, while existing workspaces remain unchanged\." \/>/);
  assert.match(page, /<div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">/);
  assert.match(page, /<p className="text-sm leading-6 text-ui-text-muted sm:whitespace-nowrap">\s+\{tab === 'mcp'/);
  assert.match(page, /<Button className="shrink-0"/);
  assert.match(page, /setDialog\('import-skill'\)/);
  assert.match(page, />Import skill<\/Button>/);
  assert.match(page, /setDialog\('create-skill'\)/);
  assert.match(page, />Create skill<\/Button>/);
  assert.match(page, /function CreateSkillDialog/);
  assert.match(page, /id="create-platform-skill-title" className="type-panel-title">Create Skill<\/h3>/);
  assert.match(page, /\{ id: 'name', label: 'Name' \}/);
  assert.match(page, /\{ id: 'files', label: 'Edit files' \}/);
  assert.match(page, /\{ id: 'availability', label: 'Availability' \}/);
  assert.match(page, /<ModalStepIndicator steps=\{steps\} currentStepId=\{step\}/);
  assert.match(modalSteps, /export const ModalStepIndicator/);
  assert.match(modalSteps, /complete \? <CheckCircle2/);
  assert.match(page, /The next step creates a starter SKILL\.md\. You can edit the YAML header and body before saving\./);
  assert.match(page, /setSkillContent\(buildManualSkillContent\(name\)\)/);
  assert.match(page, /aria-label="SKILL\.md content"/);
  assert.match(page, /Choose where this skill will be available in new workspaces\./);
  assert.match(page, /step === 'name'/);
  assert.match(page, /step === 'files'/);
  assert.match(page, /setStep\('availability'\)/);
  assert.match(page, /setStep\('files'\)/);
  assert.match(page, /source: \{ type: 'manual' \}/);
  assert.match(page, /files: \[\{ path: 'SKILL\.md', content: skillContent \}\]/);
  assert.doesNotMatch(page, /setDescription\(|setInstructions\(/);
  assert.match(page, /if \(item\.source\.type === 'manual'\) return 'Manual skill'/);
  assert.match(page, /Workspace users have to explicitly enable the MCP servers they want to use, then configure authentication through the existing MCP setup\./);
  assert.match(page, /Workspace users have to explicitly enable the skills they want to use\./);
  assert.match(page, /const hasSelection = selected\.length > 0/);
  assert.match(page, /className="flex items-center justify-between gap-3"/);
  assert.match(page, /\{hasSelection \? 'Clear' : 'Select all'\}/);
  assert.match(page, /onChange\(hasSelection \? \[\] : allDestinations\)/);
  assert.match(page, /data-selected=\{isSelected\} className="destination-choice/);
  assert.match(styles, /\.audit-time-filter\[aria-pressed="true"\],\s*\.destination-choice\[data-selected="true"\][\s\S]*border-color: rgb\(var\(--admin-clay\)\);[\s\S]*border-width: 2px;[\s\S]*background: rgb\(var\(--admin-clay-soft\)\);[\s\S]*color: rgb\(var\(--admin-clay-strong\)\);[\s\S]*box-shadow: none;/);
  assert.match(page, />Edit Availability<\/MenuItem>/);
  assert.match(page, /description=\{`Choose where \$\{item\.name\} will appear in\.`\}/);
  assert.doesNotMatch(page, /will appear in workspaces created after this change/);
  assert.doesNotMatch(page, />Select all<\/button><button[^>]*>Clear</);
  assert.doesNotMatch(page, /<span className="block">New workspaces are created with these defaults/);
  assert.doesNotMatch(page, /w-full min-w-0 space-y-2/);
  assert.match(page, /<DataTable[^>]*className="min-w-\[52rem\] table-fixed"/);
  assert.match(page, /<DataTableHeaderCell density="compact" className="w-\[30%\]">/);
  assert.match(page, /<DataTableHeaderCell density="compact" className="w-\[35%\]">Available In<\/DataTableHeaderCell>/);
  assert.match(page, /<DataTableHeaderCell density="compact" className="w-\[23%\]">Default<\/DataTableHeaderCell>/);
  assert.match(page, /<DataTableHeaderCell density="compact" className="w-\[12%\] text-right">Actions<\/DataTableHeaderCell>/);
  assert.match(page, /<Switch checked=\{item\.enabled !== false\}/);
  assert.match(page, /<OverflowActionMenu label=/);
  assert.match(page, /<MenuItem destructive/);
  assert.doesNotMatch(page, /responsive-actions flex flex-wrap justify-end gap-2/);
  assert.match(formControls, /role="switch"/);
  assert.match(overflowMenu, /role="menu"/);
  assert.match(overflowMenu, /createPortal/);
});

test('responsive layout evidence covers compact records, fluid shells, and viewport-safe overlays', async () => {
  const [index, app, styles, pageComposition, dataTable, select, workspaces, audit] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/PageComposition.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/DataTable.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/Select.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/WorkspacesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/AuditPage.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(index, /viewport-fit=cover/);
  assert.match(app, /mobile-drawer-close/);
  assert.match(app, /<PageShell key=\{route\.name\}>/);
  assert.match(styles, /\.responsive-table/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /@container \(min-width: 56rem\)/);
  assert.match(pageComposition, /max-w-\[112rem\]/);
  assert.match(dataTable, /responsive-table-frame/);
  assert.match(select, /openAbove/);
  assert.match(workspaces, /data-primary="true"/);
  assert.match(audit, /audit-cell/);
});

test('platform data surfaces keep the original compact table-header rhythm', async () => {
  const [users, workspaces, defaults, audit, styles] = await Promise.all([
    readFile(new URL('../src/pages/UsersPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/WorkspacesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/WorkspaceDefaultsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/AuditPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  ]);
  const tableHeaders = [...`${users}\n${workspaces}\n${defaults}`.matchAll(/<DataTableHeaderCell\b([^>]*)>/g)];
  assert.equal(tableHeaders.length, 18);
  for (const [, attributes] of tableHeaders) assert.match(attributes, /\bdensity="compact"/);
  assert.match(audit, /audit-grid-header type-micro-label/);
  assert.match(styles, /\.audit-grid-header \{ padding: \.625rem 1\.25rem; \}/);
});

test('admin audit matches the two-row filter and event-led ledger reference', async () => {
  const [audit, styles] = await Promise.all([
    readFile(new URL('../src/pages/AuditPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  ]);
  for (const label of ['All events', 'Workspace name or ID', 'Admin actor', 'All outcomes', 'Today', 'Last 24h', 'Past 7d', 'Past 30d', 'Custom range', 'Clear', 'Apply filters']) {
    assert.match(audit, new RegExp(label));
  }
  assert.match(audit, /border-t border-ui-border pt-4/);
  assert.match(audit, /aria-controls="audit-custom-range"/);
  assert.match(audit, /customRangeOpen &&/);
  assert.match(audit, /className="audit-time-filter w-full sm:w-auto"/);
  assert.match(audit, /className="audit-time-filter col-span-2 w-full sm:w-auto"/);
  assert.match(audit, /aria-pressed=\{activeTimePreset === value\}/);
  assert.match(styles, /\.audit-time-filter\[aria-pressed="true"\][\s\S]*border-color: rgb\(var\(--admin-clay\)\);[\s\S]*background: rgb\(var\(--admin-clay-soft\)\);[\s\S]*color: rgb\(var\(--admin-clay-strong\)\);/);
  assert.doesNotMatch(audit, /activeTimePreset === value \? 'primary'/);
  assert.match(audit, /className="audit-page-header"/);
  assert.match(audit, /new IntersectionObserver/);
  assert.match(audit, /rootMargin: '240px 0px'/);
  assert.match(audit, /ref=\{sentinelRef\}/);
  assert.match(audit, /className="audit-detail-table border-y border-ui-border"/);
  assert.doesNotMatch(audit, /<dl className="definition-grid rounded-lg border border-ui-border bg-ui-surface"/);
  assert.doesNotMatch(audit, /heading="Governance Events"/);
  assert.doesNotMatch(audit, /Privacy-filtered/);
  assert.match(audit, /const parts = auditAffectedParts\(event\)/);
  assert.match(audit, /parts\.map/);
  assert.match(audit, /subjectDisplayName \|\| 'Unknown user'/);
  assert.doesNotMatch(audit, /data-label="Actor"><strong/);
  assert.doesNotMatch(audit, /<strong>\{value\}<\/strong>/);
  assert.match(audit, /\{auditEventText\(event\)\}/);
  assert.doesNotMatch(audit, /\{humanizeAuditAction\(event\.action\)\} ·/);
  assert.match(audit, /\{event\.action \|\| 'unknown'\} · \{titleCase\(event\.outcome \|\| 'unknown'\)\}/);
  assert.match(audit, /audit-log-copy/);
  assert.match(styles, /--audit-log-bg: 38 35 32/);
  assert.match(styles, /\.audit-detail-table > div \{[\s\S]*grid-template-columns: minmax\(6\.5rem, \.34fr\) minmax\(0, 1fr\);[\s\S]*padding: \.75rem \.5rem;/);
  assert.match(styles, /@media \(min-width: 90rem\) \{[\s\S]*\.audit-page-header \.type-body \{ white-space: nowrap; \}/);
  assert.match(styles, /minmax\(14rem, 2fr\)/);
  assert.match(styles, /\.audit-record > :last-child \{ justify-self: end; \}/);
});

test('workspace directory matches the full-width search and result-count reference', async () => {
  const [workspaces, pageComposition] = await Promise.all([
    readFile(new URL('../src/pages/WorkspacesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/PageComposition.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(pageComposition, /toolbarFullWidth/);
  assert.match(workspaces, /toolbarFullWidth/);
  assert.match(workspaces, /sm:grid-cols-\[minmax\(0,1fr\)_11rem_auto\]/);
  assert.match(workspaces, /<StatusBadge className="h-11 justify-center whitespace-nowrap px-4 tabular-nums">[\s\S]*Showing \{items\.length\} of \{Math\.max\(totalWorkspaceCount, items\.length\)\}/);
  assert.doesNotMatch(workspaces, /<span className="inline-flex h-11 items-center justify-center rounded-full/);
  assert.match(workspaces, /Showing \{items\.length\} of \{Math\.max\(totalWorkspaceCount, items\.length\)\}/);
  assert.match(workspaces, /loadAllPages<any>\('\/workspaces'\)/);
  assert.match(workspaces, /h-2 w-2 rounded-full bg-status-success/);
  assert.doesNotMatch(workspaces, /Showing \{items\.length\}\{nextCursor/);
});

test('users match the workspace directory and compact details patterns', async () => {
  const users = await readFile(new URL('../src/pages/UsersPage.tsx', import.meta.url), 'utf8');
  assert.match(users, /<DataSurface toolbarFullWidth toolbar=/);
  assert.match(users, /md:grid-cols-\[minmax\(9rem,1\.25fr\)_minmax\(10rem,1fr\)_10\.5rem_auto\]/);
  assert.match(users, /ariaLabel="Filter users by workspace"[\s\S]*ariaLabel="Filter users by verification"/);
  assert.doesNotMatch(users, /ariaLabel="Filter users by verification"[\s\S]*ariaLabel="Filter users by workspace"/);
  assert.match(users, /Showing \{visibleUsers\.length\} of \{users\.length\}/);
  assert.match(users, /<Combobox/);
  assert.match(users, /leadingIcon=\{<PanelsTopLeft className="h-4 w-4" aria-hidden="true" \/>\}/);
  assert.match(users, /new URLSearchParams\(location\.search\)\.get\('workspace'\)/);
  assert.match(users, /const userPageLimit = 25/);
  assert.match(users, /setNextCursor/);
  assert.match(users, /load\(\{ append: true \}\)/);
  assert.match(users, /Loading…' : 'Load more'/);
  assert.doesNotMatch(users, /heading="User Directory"/);
  assert.match(users, />User<\/DataTableHeaderCell>[\s\S]*>Workspaces<\/DataTableHeaderCell>[\s\S]*>Status<\/DataTableHeaderCell>[\s\S]*>Created<\/DataTableHeaderCell>/);
  assert.doesNotMatch(users, />Verification<\/DataTableHeaderCell>/);
  assert.match(users, /<td data-label="Workspaces"[\s\S]*<td data-label="Status"/);
  assert.match(users, /<StatusBadge tone="success" className="gap-1\.5">[\s\S]*h-2 w-2 rounded-full bg-status-success[\s\S]*Verified[\s\S]*<\/StatusBadge>/);
  assert.match(users, /text-accent-readable[\s\S]*h-2 w-2 rounded-full bg-accent[\s\S]*Unverified/);
  assert.doesNotMatch(users, /<StatusBadge[^>\n]*>\s*Unverified/);
  assert.match(users, /<section className="px-4 py-3 sm:px-5">/);
  assert.match(users, /grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(users, /className="!mt-0 px-4 py-3 sm:px-5"/);
  assert.doesNotMatch(users, /<Card><dl className="definition-grid"/);
  assert.match(users, /workspace\{memberships\.length === 1 \? '' : 's'\}/);
  assert.match(users, /Workspaces and roles currently assigned to this user\./);
  assert.match(users, /<DataTableHeaderCell density="compact" className="w-\[42%\] font-medium">Workspace<\/DataTableHeaderCell>/);
  assert.match(users, /<DataTableHeaderCell density="compact" className="w-\[58%\] font-medium">Role<\/DataTableHeaderCell>/);
  assert.match(users, /roleDrafts/);
  assert.match(users, /Update Role/);
  assert.match(users, /void updateMembershipRole\(membership, nextRole\)/);
  assert.match(users, /grid w-full gap-2 sm:grid-cols-\[8rem_minmax\(0,1fr\)\]/);
  assert.match(users, /<div className="flex justify-end gap-2 pr-1 md:pr-0">[\s\S]*className="min-w-0 px-2\.5"[\s\S]*Update Role[\s\S]*Revoke workspace access/);
  assert.match(users, /variant="dangerSoft"[\s\S]*size="icon"[\s\S]*className="h-11 w-11 shrink-0 hover:border-control-boundary hover:bg-control-danger hover:text-control-danger-fg sm:h-11 sm:w-11"[\s\S]*Revoke workspace access/);
  assert.doesNotMatch(users, /sm:min-w-\[6\.5rem\]/);
  assert.match(users, /formatMembershipLifecycle\(membership\.createdAt, membership\.updatedAt\)/);
  assert.doesNotMatch(users, /Added \{formatDate\(membership\.createdAt\)\}/);
  assert.doesNotMatch(users, /setDialog\('role'\)/);
  assert.match(users, /Revoke access to \$\{membership\.workspace\.name\}\?/);
  assert.match(users, /<InlineAlert tone="neutral" className="bg-ui-surface-strong">/);
  assert.match(users, /The user keeps their AcornOps account and access to other workspaces\./);
});

test('workspace details use compact metadata and explicit inline access actions', async () => {
  const [workspaces, pageComposition, rightSidePanel, button] = await Promise.all([
    readFile(new URL('../src/pages/WorkspacesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/PageComposition.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/RightSidePanel.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/Button.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(rightSidePanel, /sm:max-w-\[min\(45rem,92vw\)\]/);
  assert.match(pageComposition, /compact\?: boolean/);
  assert.match(pageComposition, /compact \? 'type-panel-title text-ui-text' : 'type-section-title text-ui-text'/);
  assert.doesNotMatch(workspaces, /sm:max-w-\[min\(56rem,92vw\)\]/);
  assert.match(workspaces, /type-panel-title/);
  assert.match(workspaces, /grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3/);
  assert.equal((workspaces.match(/\n\s+compact\n/g) || []).length, 2);
  assert.equal((workspaces.match(/className="!mt-0 px-4 py-3 sm:px-5"/g) || []).length, 2);
  assert.match(workspaces, /<section className="px-4 py-3 sm:px-5">/);
  assert.doesNotMatch(workspaces, /className="px-4 py-4 sm:px-5"/);
  assert.doesNotMatch(workspaces, /className="border-t border-ui-border px-4 py-4 sm:px-5"/);
  assert.match(workspaces, /Kubernetes Clusters/);
  assert.match(workspaces, /Virtual Machines/);
  assert.doesNotMatch(workspaces, /<Card><dl className="definition-grid"/);
  assert.match(workspaces, /roleDrafts/);
  assert.match(workspaces, /Update Role/);
  assert.match(workspaces, /void updateMemberRole\(member, nextRole\)/);
  assert.match(workspaces, /variant="dangerSoft" size="icon" className="h-11 w-11 shrink-0 hover:border-control-boundary hover:bg-control-danger hover:text-control-danger-fg sm:h-11 sm:w-11"[\s\S]*Revoke workspace access/);
  assert.doesNotMatch(workspaces, /function RoleDialog/);
  assert.doesNotMatch(workspaces, /setDialog\('role'\)/);
  assert.match(workspaces, /Members and roles currently assigned to this workspace\./);
  assert.match(workspaces, /member\{members\.length === 1 \? '' : 's'\}/);
  assert.match(workspaces, /<DataTableHeaderCell density="compact" className="w-\[25%\] font-medium">User<\/DataTableHeaderCell>/);
  assert.match(workspaces, /<DataTableHeaderCell density="compact" className="w-\[29%\] font-medium">Email<\/DataTableHeaderCell>/);
  assert.match(workspaces, /<DataTableHeaderCell density="compact" className="w-\[46%\] font-medium">Role<\/DataTableHeaderCell>/);
  assert.match(workspaces, /<DataTableFrame className="-mx-4 border-t border-ui-border sm:-mx-5">/);
  assert.doesNotMatch(workspaces, /-mx-4 border-y border-ui-border sm:-mx-5/);
  assert.match(workspaces, /Revoke access to \$\{workspace\.name\}\?/);
  assert.match(workspaces, /<FieldLabel htmlFor="workspace-confirmation" className="text-sm font-normal leading-5 normal-case tracking-normal">[\s\S]*Type <strong className="font-semibold">\{workspace\.name\}<\/strong> to confirm[\s\S]*<\/FieldLabel>/);
  assert.doesNotMatch(workspaces, /<FieldLabel htmlFor="workspace-confirmation">Type <strong>/);
  assert.match(workspaces, /<InlineAlert tone="neutral" className="bg-ui-surface-strong">/);
  assert.match(workspaces, /Workspace access will be removed immediately/);
  assert.doesNotMatch(workspaces, /Workspace Access Will Be Removed Immediately/);
  assert.match(workspaces, /The user keeps their AcornOps account and access to other workspaces\./);
  assert.match(workspaces, /variant=\{workspace\.lifecycleStatus === 'suspended' \? 'secondary' : 'dangerSoft'\}/);
  assert.match(button, /dangerSoft: 'border border-status-danger\/20 bg-status-danger-soft text-status-danger-text/);
});

test('overview uses the management console typography and surface rhythm', async () => {
  const [overview, pageComposition, tokens, fonts] = await Promise.all([
    readFile(new URL('../src/pages/OverviewPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/src/PageComposition.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/tokens.css', import.meta.url), 'utf8'),
    readFile(new URL('../packages/ui/fonts.js', import.meta.url), 'utf8')
  ]);
  assert.match(overview, /items-center gap-4 px-5 py-4 sm:px-6/);
  assert.match(overview, /mt-6 grid gap-6/);
  assert.match(overview, /xl:grid-cols-2 xl:items-stretch/);
  assert.match(overview, /<ol className="xl:flex xl:h-full xl:flex-col xl:justify-start">/);
  assert.match(overview, /model\.environmentLeaders\.length === 3 \? 'xl:flex-1' : ''/);
  assert.doesNotMatch(overview, /className="data-row[^"]*xl:flex-1/);
  assert.match(overview, /grid h-9 w-12 shrink-0 place-items-center/);
  assert.doesNotMatch(overview, /grid h-9 min-w-9/);
  assert.equal((overview.match(/xl:min-h-\[4\.75rem\]/g) || []).length, 2);
  assert.equal((overview.match(/flex min-w-0 flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-surface/g) || []).length, 2);
  assert.match(overview, /<section className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface">[\s\S]*Platform Footprint/);
  assert.equal((overview.match(/border-b border-ui-border/g) || []).length, 3);
  assert.match(overview, /type-row-title/);
  assert.match(overview, /type-caption/);
  assert.match(overview, /type-data/);
  assert.match(overview, /bg-\[rgb\(var\(--admin-clay-soft\)\)\]/);
  assert.match(overview, /label: 'Workspaces'[\s\S]*icon: PanelsTopLeft/);
  assert.doesNotMatch(overview, /icon: Building2/);
  assert.match(overview, /Portfolio conditions that may need administrator attention\./);
  assert.doesNotMatch(overview, /Covers suspended access, identity verification, and connected-environment concentration\./);
  assert.match(overview, /rounded-md border border-ui-border bg-ui-bg/);
  assert.doesNotMatch(overview, /status-success|status-danger/);
  assert.match(overview, /<aside[\s\S]*aria-label="Data boundary"[\s\S]*bg-ui-surface-strong[\s\S]*<LockKeyhole[\s\S]*Governance data only\./);
  assert.doesNotMatch(overview, /<InlineAlert tone="neutral"[^>]*>[\s\S]*Governance data only\./);
  assert.match(pageComposition, /mb-\[var\(--ao-header-content-gap\)\]/);
  assert.match(pageComposition, /type-route-title/);
  assert.match(pageComposition, /type-section-title/);
  assert.match(tokens, /--ao-header-content-gap: 2rem/);
  assert.match(tokens, /\.type-row-title/);
  assert.match(tokens, /\.type-caption/);
  assert.match(tokens, /\.type-data/);
  assert.match(fonts, /outfit\/latin-400\.css/);
  assert.match(fonts, /outfit\/latin-800\.css/);
  assert.doesNotMatch(overview, /PageSection/);
  assert.doesNotMatch(overview, /1\.2fr|\.8fr/);
});

test('authored UI headings use title capitalization with accepted sentence-case exceptions', async () => {
  const pageUrls = [
    '../src/pages/OverviewPage.tsx',
    '../src/pages/WorkspacesPage.tsx',
    '../src/pages/UsersPage.tsx',
    '../src/pages/SettingsPage.tsx',
    '../src/pages/WorkspaceDefaultsPage.tsx',
    '../src/pages/AuditPage.tsx'
  ];
  const pages = await Promise.all(pageUrls.map((url) => readFile(new URL(url, import.meta.url), 'utf8')));
  const source = pages.join('\n');
  const patterns = [
    /<[A-Z][A-Za-z]*\b[^>]*\btitle="([^"]+)"/gs,
    /<DataSurface\b[^>]*\bheading="([^"]+)"/gs,
    /<DataTableHeaderCell[^>]*>([^<{]+)</g,
    /<legend[^>]*>([^<{]+)</g
  ];
  const headings = patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1].trim()));
  assert.ok(headings.length >= 30);
  for (const heading of headings) {
    const words = heading.match(/[A-Za-z][A-Za-z']*/g) || [];
    for (const word of words) assert.equal(word[0], word[0].toUpperCase(), `${heading}: ${word}`);
  }
  assert.match(source, /Suspended workspace/);
  assert.match(source, /All identities are verified/);
  assert.match(source, /Identity verification needs follow-up/);
  assert.match(source, /Most connected environments are in/);
  assert.doesNotMatch(source, /Suspended Workspace/);
  assert.doesNotMatch(source, /All Identities Are Verified/);
  assert.doesNotMatch(source, /Identity Verification Needs Follow-Up/);
  assert.doesNotMatch(source, /Most Connected Environments Are In/);
  assert.doesNotMatch(source, /Connected Environments Are Concentrated In/);
  assert.match(source, /Grant Workspace Access To/);
  assert.match(source, /Grant Access To/);
  assert.match(source, /No \$\{tab === 'mcp' \? 'MCP Servers' : 'Skills'\} Found/);
  assert.match(source, /Deployment Default/);
  assert.match(source, /Write-Only/);
  assert.match(source, /Revoke access to \$\{workspace\.name\}\?/);
  assert.match(source, /Workspace access will be removed immediately/);
});

test('AI provider settings use admin-facing copy and right-aligned key actions', async () => {
  const settings = await readFile(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
  assert.match(settings, /Manage default AI provider keys and policy\./);
  assert.match(settings, /setting\.source === 'runtime_override' \? 'Admin Override'/);
  assert.doesNotMatch(settings, /Runtime Override/);
  assert.match(settings, /className="mt-auto flex flex-wrap justify-end gap-2 pt-5"/);
});
