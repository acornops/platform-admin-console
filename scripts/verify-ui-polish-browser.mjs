import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminConsoleServer } from '../server.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
async function withPage(run, pageOptions = {}) {
  const server = createAdminConsoleServer({ mode: 'mock' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage(pageOptions);
  page.setDefaultTimeout(5000);
  try { await run(page, `http://127.0.0.1:${server.address().port}`); }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
const editor = page => page.getByRole('dialog', { name: 'Create Skill', exact: true });
const confirmation = page => page.getByRole('dialog', { name: 'Discard Unsaved Skill Changes?', exact: true });

for (const count of [0, 1, 3]) {
  test(`overview portfolio labels render ${count} VM and cluster counts correctly`, () => withPage(async (page, origin) => {
    await page.route('**/admin-console-api/workspaces?**', route => route.fulfill({ json: { items: [{ id: 'count-workspace', name: 'Count workspace', clusterCount: count, virtualMachineCount: count, lifecycleStatus: 'active' }] } }));
    await page.goto(`${origin}/`);
    const vmLabel = count === 1 ? '1 VM' : `${count} VMs`;
    const clusterLabel = count === 1 ? '1 cluster' : `${count} clusters`;
    await page.getByText(`${count} Kubernetes · ${vmLabel}`, { exact: true }).waitFor();
    await page.getByText(`${count * 2} total (${clusterLabel} · ${vmLabel})`, { exact: true }).waitFor();
  }));
}

test('audit filter rows retain aligned 44px controls with actor guidance', () => withPage(async (page, origin) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/audit`);
  const controls = [page.getByRole('button', { name: 'Filter by event', exact: true }), page.getByLabel('Filter by workspace name or ID', { exact: true }), page.getByLabel('Admin actor subject', { exact: true }), page.getByRole('button', { name: 'Filter by outcome', exact: true })];
  const boxes = await Promise.all(controls.map(async control => { await control.waitFor(); return control.boundingBox(); }));
  for (const box of boxes) {
    assert.ok(box && Math.abs(box.height - 44) <= 1, `control height ${box?.height}`);
    assert.ok(Math.abs(box.y - boxes[0].y) <= 1, 'filter input rows align');
  }
  await page.getByRole('button', { name: 'Custom range', exact: true }).click();
  await page.screenshot({ path: '/tmp/phase06-pac-audit-filter-geometry-after.png' });
}));

for (const [timezoneId, expectedFrom] of [['Asia/Singapore', '2026-06-30T16:00:00.000Z'], ['America/New_York', '2026-07-01T04:00:00.000Z']]) {
  test(`audit explains and applies exact subject and inclusive local range in ${timezoneId}`, () => withPage(async (page, origin) => {
    await page.setViewportSize({ width: timezoneId === 'Asia/Singapore' ? 390 : 1280, height: 800 });
    await page.emulateMedia({ colorScheme: timezoneId === 'Asia/Singapore' ? 'dark' : 'light' });
    await page.goto(`${origin}/audit`);
    const actor = page.getByLabel('Admin actor subject', { exact: true });
    await actor.fill(`oidc|${'long-subject-'.repeat(15)}`);
    assert.equal(await actor.getAttribute('aria-describedby'), 'audit-actor-help');
    await page.getByText('Changes not applied.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Custom range', exact: true }).click();
    await page.getByText(`Times use ${timezoneId}.`, { exact: false }).waitFor();
    await page.getByLabel('From', { exact: true }).fill('2026-07-02T00:00');
    await page.getByLabel('To', { exact: true }).fill('2026-07-01T00:00');
    const apply = page.getByRole('button', { name: 'Apply filters', exact: true });
    assert.equal(await apply.isDisabled(), true);
    await page.getByText('From must not be later than To.', { exact: true }).waitFor();
    await page.getByLabel('From', { exact: true }).fill('2026-07-01T00:00');
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/admin-audit-events?') && response.url().includes('adminActorSubject=')),
      apply.focus().then(() => page.keyboard.press('Enter'))
    ]);
    const query = new URL(response.url()).searchParams;
    assert.equal(query.get('from'), expectedFrom);
    assert.equal(query.get('adminActorSubject'), await actor.inputValue());
    assert.equal(query.has('actorName'), false);
    assert.equal(query.has('cursor'), false);
    await page.getByText('Showing results for the applied filters.', { exact: true }).waitFor();
    await page.screenshot({ path: `/tmp/phase06-pac-audit-applied-${timezoneId.replace('/', '-')}.png`, fullPage: true });
    const [cleared] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/admin-audit-events?') && !response.url().includes('adminActorSubject=')),
      page.getByRole('button', { name: 'Clear', exact: true }).click()
    ]);
    assert.equal(new URL(cleared.url()).searchParams.get('from'), null);
    assert.equal(await actor.inputValue(), '');
    await page.getByText('Showing all admin events.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `/tmp/phase06-pac-audit-${timezoneId.replace('/', '-')}.png` });
  }, { timezoneId }));
}

test('sole-owner explanations stay associated while co-owner changes remain eligible', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Manage Access', exact: true }).click();
  const ownerRole = page.getByRole('button', { name: 'Role for Maya Chen', exact: true });
  await ownerRole.waitFor();
  assert.equal(await ownerRole.isDisabled(), true);
  assert.ok(await ownerRole.getAttribute('aria-describedby'));
  await page.getByText('The workspace must keep at least one owner.', { exact: false }).waitFor();
  await page.screenshot({ path: '/tmp/phase06-pac-last-owner.png', fullPage: true });
  await page.route('**/admin-console-api/workspaces/ws_atlas/members?*', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.items[1].role = 'owner';
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Manage Access', exact: true }).click();
  await ownerRole.waitFor();
  assert.equal(await ownerRole.isEnabled(), true);
  assert.equal(await ownerRole.getAttribute('aria-describedby'), null);
}));

test('settings fields have visible label and help associations without duplicate IDs', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/settings/workspace`);
  for (const label of ['Documentation URL', 'Contact Support URL', 'Discovery mode']) {
    const control = page.getByLabel(label, { exact: true });
    await control.waitFor();
    assert.ok(await control.getAttribute('aria-describedby'), `${label} has help`);
  }
  await page.goto(`${origin}/settings/ai`);
  for (const provider of ['OpenAI', 'Anthropic', 'Gemini']) {
    await page.getByLabel(new RegExp(`${provider}.*API key`)).waitFor();
  }
  await page.getByLabel('Default provider', { exact: true }).waitFor();
  await page.getByLabel('Default model', { exact: true }).waitFor();
  await page.goto(`${origin}/settings/kubernetes`);
  await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add RBAC Profile', exact: true });
  for (const label of ['Name', 'Key', 'Description', 'Resource Rules YAML']) await dialog.getByLabel(label, { exact: true }).waitFor();
  assert.ok(await dialog.getByLabel('Resource Rules YAML', { exact: true }).getAttribute('aria-describedby'));
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(new Set(ids).size, ids.length);
}));

for (const directory of ['workspaces', 'users']) for (const exit of ['Escape', 'Close', 'Back']) {
  test(`${directory} row regains focus after panel ${exit}`, () => withPage(async (page, origin) => {
    await page.goto(`${origin}/${directory}`);
    const row = page.locator('tr[tabindex="0"]').first();
    await row.focus();
    await row.press('Enter');
    const panel = page.getByRole('dialog');
    await panel.waitFor();
    await panel.getByRole('button', { name: `Close ${directory === 'users' ? 'user' : 'workspace'} details` }).focus();
    if (exit === 'Back') await page.goBack();
    else if (exit === 'Close') await panel.getByRole('button', { name: /^Close / }).click();
    else await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.matches('tr[tabindex="0"]'));
    assert.equal(await row.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#main').getAttribute('inert'), null);
  }));
}

test('a removed panel opener restores the surviving directory landmark', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/workspaces`);
  const row = page.locator('tr[tabindex="0"]').first();
  await row.focus(); await row.press('Enter');
  const panel = page.getByRole('dialog');
  await panel.waitFor();
  await row.evaluate(node => node.remove());
  await panel.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#main').evaluate(node => node === document.activeElement), true);
}));

test('nested select, action dialog, and panel unwind focus one Escape at a time', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/workspaces`);
  const row = page.locator('tr[tabindex="0"]').filter({ hasText: 'Atlas Research' });
  await row.focus(); await row.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Atlas Research', exact: true });
  const change = panel.getByRole('button', { name: 'Change Plan', exact: true });
  await change.click();
  const dialog = page.getByRole('dialog', { name: /Change.*Plan/ });
  const select = dialog.getByRole('button', { name: 'Plan', exact: true });
  await select.click(); await page.getByRole('option').first().waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('option').count(), 0);
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await select.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await change.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await row.evaluate(node => node === document.activeElement), true);
}));

for (const width of [320, 390, 768]) for (const theme of ['light', 'dark']) {
  test(`long workspace panel retains its exit at ${width}px ${theme} and short/reflow heights`, () => withPage(async (page, origin) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.route('**/admin-console-api/workspaces/ws_atlas', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.name = 'Atlas Research 長いワークスペース名 '.repeat(12);
      await route.fulfill({ response, json: body });
    });
    await page.goto(`${origin}/workspaces/ws_atlas`);
    const panel = page.getByRole('dialog');
    const close = panel.getByRole('button', { name: 'Close workspace details' });
    await panel.getByText('Workspace Lifecycle', { exact: true }).scrollIntoViewIfNeeded();
    for (const height of [568, 360]) {
      await page.setViewportSize({ width, height });
      const box = await close.boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      assert.ok(width >= 640 || (box.width >= 44 && box.height >= 44));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width, height: 568 });
    // CSS zoom is reflow stress, not browser zoom or screen-reader evidence.
    await page.locator('html').evaluate(node => { node.style.zoom = '2'; });
    await panel.getByText('Workspace Lifecycle', { exact: true }).scrollIntoViewIfNeeded();
    const zoomed = await close.boundingBox();
    assert.ok(zoomed && zoomed.y >= 0 && zoomed.y + zoomed.height <= 568);
    await page.locator('html').evaluate(node => { node.style.zoom = ''; });
    await page.screenshot({ path: `/tmp/phase05-pac-panel-${width}-${theme}.png` });
  }));
}
async function open(page, origin) {
  await page.goto(`${origin}/workspace-defaults?tab=skills`);
  await page.getByRole('button', { name: 'Create skill', exact: true }).click();
  await editor(page).getByLabel('Skill name').focus();
}

for (const close of ['X', 'Escape', 'backdrop']) {
  test(`skill name survives ${close}; Keep editing retains it and Discard clears it`, () => withPage(async (page, origin) => {
    await open(page, origin);
    await editor(page).getByLabel('Skill name').fill('Draft response skill');
    if (close === 'X') await editor(page).getByRole('button', { name: 'Close skill editor' }).click();
    else if (close === 'Escape') await page.keyboard.press('Escape');
    else await page.locator('.dialog-backdrop').last().click({ position: { x: 8, y: 8 } });
    await confirmation(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await editor(page).getByLabel('Skill name').inputValue(), 'Draft response skill');
    await editor(page).getByRole('button', { name: 'Close skill editor' }).click();
    await confirmation(page).getByRole('button', { name: 'Discard', exact: true }).click();
    await editor(page).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Create skill', exact: true }).click();
    assert.equal(await editor(page).getByLabel('Skill name').inputValue(), '');
  }));
}

test('file content and destinations survive dismissal and failed submit; pending does not close', () => withPage(async (page, origin) => {
  let finish;
  await page.route('**/admin-console-api/workspace-defaults', route => {
    if (route.request().method() !== 'POST') return route.continue();
    return new Promise(resolve => { finish = async () => { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Try again', retryable: true } }) }); resolve(); }; });
  });
  await open(page, origin);
  await editor(page).getByLabel('Skill name').fill('Authored skill');
  await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
  const content = '---\nname: authored-skill\ndescription: "Authored draft"\n---\n\nKeep this exact text.\n';
  await editor(page).getByLabel('SKILL.md content').fill(content);
  await page.keyboard.press('Escape');
  await confirmation(page).waitFor();
  await confirmation(page).press('Escape');
  assert.equal(await editor(page).getByLabel('SKILL.md content').inputValue(), content);
  await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
  await editor(page).getByRole('checkbox', { name: 'Kubernetes', exact: true }).uncheck();
  await page.locator('.dialog-backdrop').last().click({ position: { x: 8, y: 8 } });
  await confirmation(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(await editor(page).getByRole('checkbox', { name: 'Kubernetes', exact: true }).isChecked(), false);
  const submitted = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/workspace-defaults'));
  await editor(page).getByRole('button', { name: 'Create Skill', exact: true }).click();
  await submitted;
  await page.keyboard.press('Escape');
  assert.equal(await confirmation(page).count(), 0);
  await finish();
  await editor(page).getByText('Try again', { exact: true }).waitFor();
  await editor(page).getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal(await editor(page).getByLabel('SKILL.md content').inputValue(), content);
  await editor(page).getByRole('button', { name: 'Back', exact: true }).click();
  await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
  assert.equal(await editor(page).getByLabel('SKILL.md content').inputValue(), content);
}));

for (const dirty of [false, true]) {
test(`nested skill import menu consumes Escape without closing its ${dirty ? 'authored' : 'pristine'} parent dialog`, () => withPage(async (page, origin) => {
  await page.goto(`${origin}/workspace-defaults?tab=skills`);
  await page.getByRole('button', { name: 'Import skill', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Skill', exact: true });
  if (dirty) await dialog.getByLabel('Repository URL', { exact: true }).fill('https://github.com/example/skills');
  await dialog.getByRole('button', { name: 'Provider', exact: true }).click();
  await page.getByRole('option', { name: 'GitHub', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('option').count(), 0);
  assert.equal(await dialog.isVisible(), true);
  if (dirty) assert.equal(await dialog.getByLabel('Repository URL', { exact: true }).inputValue(), 'https://github.com/example/skills');
}));
}

test('pristine close and successful submit leave no dirty prompt; success toast has success icon', () => withPage(async (page, origin) => {
  await open(page, origin);
  await page.keyboard.press('Escape');
  await editor(page).waitFor({ state: 'hidden' });
  assert.equal(await confirmation(page).count(), 0);
  await page.getByRole('button', { name: 'Create skill', exact: true }).click();
  await editor(page).getByLabel('Skill name').fill('Safe fixture skill');
  await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
  await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
  await editor(page).getByRole('button', { name: 'Create Skill', exact: true }).click();
  await editor(page).waitFor({ state: 'hidden' });
  await page.getByRole('status').filter({ hasText: 'Skill default created.' }).locator('.lucide-circle-check').waitFor();
  assert.equal(await confirmation(page).count(), 0);
}));

test('browser Back keeps the full skill draft on Keep editing and leaves only after Discard', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/`);
  await page.getByRole('link', { name: 'Capabilities', exact: true }).click();
  await page.getByRole('tab', { name: 'Skills', exact: true }).click();
  await page.getByRole('button', { name: 'Create skill', exact: true }).click();
  await editor(page).getByLabel('Skill name').fill('History draft');
  await page.goBack();
  await confirmation(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(await editor(page).getByLabel('Skill name').inputValue(), 'History draft');
  assert.match(page.url(), /workspace-defaults/);
  await page.goBack();
  await confirmation(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await page.waitForURL(origin + '/');
}));

test('repeated Back and Forward cancellation preserves history entries and foreign state', () => withPage(async (page, origin) => {
  await page.addInitScript(() => history.replaceState({ retained: 'existing-state' }, ''));
  await page.goto(`${origin}/`);
  await page.getByRole('link', { name: 'Capabilities', exact: true }).click();
  await page.getByRole('tab', { name: 'Skills', exact: true }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.goBack();
  await page.getByRole('button', { name: 'Create skill', exact: true }).click();
  await editor(page).getByLabel('Skill name').fill('Traversal draft');
  const historyLength = await page.evaluate(() => history.length);
  for (const direction of ['back', 'forward', 'back', 'forward']) {
    await page.evaluate(value => history[value](), direction);
    await confirmation(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await editor(page).getByLabel('Skill name').inputValue(), 'Traversal draft');
    assert.match(page.url(), /workspace-defaults/);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    assert.equal(await page.evaluate(() => history.state.retained), 'existing-state');
  }
  await page.goForward();
  await confirmation(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await page.waitForURL(origin + '/');
}));

for (const [status, code] of [[401, 'ADMIN_SESSION_REQUIRED'], [403, 'ADMIN_REAUTH_REQUIRED']]) {
  test(`required authorization redirect ${code} bypasses a dirty skill guard`, () => withPage(async (page, origin) => {
    let unloadPrompts = 0;
    page.on('dialog', dialog => { unloadPrompts += 1; void dialog.dismiss(); });
    await page.route('**/admin-auth/oidc/login?*', route => route.fulfill({ contentType: 'text/html', body: 'Administrator sign-in required' }));
    await page.route('**/admin-console-api/workspace-defaults', route => route.request().method() === 'POST'
      ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code, message: 'Sign in required' } }) })
      : route.continue());
    await open(page, origin);
    await editor(page).getByLabel('Skill name').fill('Authorization draft');
    await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
    await editor(page).getByRole('button', { name: 'Next', exact: true }).click();
    await editor(page).getByRole('button', { name: 'Create Skill', exact: true }).click();
    await page.waitForURL('**/admin-auth/oidc/login?*', { timeout: 5000 });
    assert.equal(unloadPrompts, 0);
  }));
}
