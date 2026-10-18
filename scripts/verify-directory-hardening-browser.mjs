import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminConsoleServer } from '../server.mjs';

const playwright = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;
async function withPage(run) {
  const server = createAdminConsoleServer({ mode: 'mock' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  try { await run(page, `http://127.0.0.1:${server.address().port}`); }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
const workspace = (id, name) => ({ id, name, memberCount: 0, lifecycleStatus: 'active', createdAt: '2026-01-01T00:00:00Z' });
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test('grant recipient stays keyboard-selected with a stationary pointer over the scrolled menu', () => withPage(async (page, origin) => {
  await page.route('**/admin-console-api/users?*', route => reply(route, { items: Array.from({ length: 125 }, (_, index) => ({
    id: `pointer-user-${index + 1}`, displayName: `Person ${String(index + 1).padStart(3, '0')}`, email: `person${index + 1}@example.test`
  })) }));
  const grants = [];
  await page.route('**/admin-console-api/workspaces/ws_atlas/members', route => {
    if (route.request().method() !== 'POST') return route.continue();
    grants.push(route.request().postDataJSON());
    return reply(route, {}, 201);
  });
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Manage Access' }).click();
  await page.getByRole('button', { name: 'Add workspace access' }).click();
  const dialog = page.getByRole('dialog', { name: 'Grant Access To Atlas Research', exact: true });
  const user = dialog.getByRole('button', { name: 'User', exact: true });
  await user.click();
  const options = page.getByRole('option');
  await options.last().waitFor({ state: 'visible' });
  assert.equal(await options.count(), 125);
  await options.first().hover();
  await user.press('End');
  await user.press('ArrowUp');
  await user.press('ArrowDown');
  await user.press('Enter');
  assert.match(await user.innerText(), /Person 125 \(person125@example.test\)/);
  await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).click();
  await page.getByRole('option', { name: 'Member', exact: true }).click();
  await dialog.getByRole('button', { name: 'Grant Access', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(grants, [{ userId: 'pointer-user-125', role: 'member', createUserIfMissing: false, reason: 'Platform admin granted Member access to Atlas Research' }]);
}));

for (const { width, theme } of [1440, 390].flatMap(width => ['light', 'dark'].map(theme => ({ width, theme })))) {
  test(`workspace grant requires deliberate recipient and role at ${width}px ${theme}`, () => withPage(async (page, origin) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    const grants = [];
    await page.route('**/admin-console-api/users?*', async route => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return reply(route, { items: [
        { id: 'alex-1', displayName: 'Alex Chen', email: 'alex1@example.test' },
        { id: 'alex-2', displayName: 'Alex Chen', email: 'alex2@example.test' },
        { id: 'usr_maya', displayName: 'Maya Chen', email: 'maya@atlas.example' }
      ] });
    });
    await page.route('**/admin-console-api/workspaces/ws_atlas/members', route => {
      if (route.request().method() !== 'POST') return route.continue();
      grants.push(route.request().postDataJSON());
      return reply(route, {}, 201);
    });
    await page.goto(`${origin}/workspaces/ws_atlas`);
    assert.equal(/dark/.test(await page.locator('html').getAttribute('class') || ''), theme === 'dark');
    await page.getByRole('button', { name: 'Manage Access' }).click();
    await page.getByRole('button', { name: 'Add workspace access' }).click();
    const dialog = page.getByRole('dialog', { name: 'Grant Access To Atlas Research', exact: true });
    const submit = dialog.getByRole('button', { name: 'Grant Access', exact: true });
    assert.equal(await submit.isDisabled(), true);
    assert.match(await dialog.getByRole('button', { name: 'User', exact: true }).innerText(), /Select user/);
    assert.match(await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).innerText(), /Select role/);
    await dialog.locator('form').evaluate(form => form.requestSubmit());
    assert.deepEqual(grants, []);
    await dialog.getByRole('button', { name: 'User', exact: true }).click();
    assert.equal(await page.getByRole('option', { name: /Maya Chen/ }).count(), 0);
    await page.getByRole('option', { name: 'Alex Chen (alex2@example.test)', exact: true }).click();
    assert.equal(await submit.isDisabled(), true);
    await dialog.locator('form').evaluate(form => form.requestSubmit());
    assert.deepEqual(grants, []);
    await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    assert.equal(await submit.isDisabled(), false);
    await page.screenshot({ path: `/tmp/acornops-phase03-pac-workspace-${width}-${theme}.png` });
    await submit.click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(grants.length, 1);
    assert.equal(grants[0].userId, 'alex-2');
    assert.equal(grants[0].createUserIfMissing, false);
    assert.equal(grants[0].role, 'auditor');
    assert.equal(grants[0].reason, 'Platform admin granted Auditor access to Atlas Research');
  }));

  test(`user grant requires deliberate workspace and role at ${width}px ${theme}`, () => withPage(async (page, origin) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    const grants = [];
    await page.route('**/admin-console-api/workspaces?*', async route => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return route.continue();
    });
    await page.route('**/admin-console-api/workspaces/*/members', route => {
      if (route.request().method() !== 'POST') return route.continue();
      grants.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
      return reply(route, {}, 201);
    });
    await page.goto(`${origin}/users/usr_maya`);
    assert.equal(/dark/.test(await page.locator('html').getAttribute('class') || ''), theme === 'dark');
    await page.getByRole('button', { name: 'Grant Access', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Grant Workspace Access To Maya Chen', exact: true });
    const submit = dialog.getByRole('button', { name: 'Grant Access', exact: true });
    assert.equal(await submit.isDisabled(), true);
    await dialog.locator('form').evaluate(form => form.requestSubmit());
    assert.deepEqual(grants, []);
    await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).click();
    await page.getByRole('option', { name: 'Member', exact: true }).click();
    assert.equal(await submit.isDisabled(), true);
    await dialog.getByRole('button', { name: 'Workspace', exact: true }).click();
    assert.equal(await page.getByRole('option', { name: 'Atlas Research', exact: true }).count(), 0);
    await page.getByRole('option', { name: 'Cedar Systems', exact: true }).click();
    assert.equal(await submit.isDisabled(), false);
    assert.match(await dialog.innerText(), /maya@atlas.example/);
    await page.screenshot({ path: `/tmp/acornops-phase03-pac-user-${width}-${theme}.png` });
    await submit.click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(grants.length, 1);
    assert.equal(grants[0].path, '/admin-console-api/workspaces/ws_cedar/members');
    assert.deepEqual(grants[0].body, { userId: 'usr_maya', role: 'member', createUserIfMissing: false, reason: 'Platform admin granted Member access to Cedar Systems' });
  }));
}

test('workspace searches ignore stale responses and retain visible errors with retry', () => withPage(async (page, origin) => {
  let oldRequest;
  let fail = true;
  await page.route('**/admin-console-api/workspaces?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'old') { oldRequest = route; return; }
    if (q === 'broken' && fail) return reply(route, { error: { message: 'Directory unavailable' } }, 503);
    return reply(route, { items: [workspace(q || 'initial', q || 'Initial')], nextCursor: q === 'new' ? 'new-cursor' : undefined });
  });
  await page.goto(`${origin}/workspaces`);
  await page.getByText('Initial', { exact: true }).waitFor();
  const search = page.getByRole('textbox', { name: 'Search workspaces by name' });
  await search.fill('old');
  await page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'old');
  await search.fill('new');
  await page.getByText('new', { exact: true }).first().waitFor();
  await reply(oldRequest, { items: [workspace('stale', 'Stale result')], nextCursor: 'old-cursor' });
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('Stale result', { exact: true }).count(), 0);
  await search.fill('broken');
  await page.getByText(/Directory unavailable/).waitFor();
  assert.equal(await page.getByText('new', { exact: true }).count() > 0, true);
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByText('broken', { exact: true }).first().waitFor();
}));

test('workspace-filtered users load bounded pages without detail fan-out and surface failures', () => withPage(async (page, origin) => {
  const requests = [];
  let fail = false;
  await page.route('**/admin-console-api/users?*', route => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    if (fail) return reply(route, { error: { message: 'User search unavailable' } }, 503);
    const offset = params.has('cursor') ? 25 : 0;
    return reply(route, { items: Array.from({ length: 25 }, (_, index) => ({ id: `user-${index + offset}`, displayName: `Person ${index + offset}`, email: `person${index + offset}@example.test`, emailVerified: true, workspaceMembershipCount: 1 })), nextCursor: offset ? undefined : 'page-2' });
  });
  const details = [];
  page.on('request', request => { if (/\/users\/user-/.test(request.url())) details.push(request.url()); });
  await page.goto(`${origin}/users?workspace=Atlas`);
  await page.getByText('Person 0', { exact: true }).waitFor();
  assert.deepEqual(requests, [{ limit: '25', workspaceQuery: 'Atlas' }]);
  assert.deepEqual(details, []);
  await page.getByRole('button', { name: 'Load more' }).click();
  await page.getByText('Person 49', { exact: true }).waitFor();
  assert.deepEqual(requests[1], { limit: '25', workspaceQuery: 'Atlas', cursor: 'page-2' });
  fail = true;
  await page.getByRole('combobox', { name: 'Filter users by workspace' }).fill('Cedar');
  await page.getByText(/User search unavailable/).waitFor();
  assert.equal(await page.getByText('Person 0', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Retry' }).count(), 1);
}));

test('grant, plan and skill import controls expose field names and keyboard selection', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Manage Access' }).click();
  await page.getByRole('button', { name: 'Add workspace access' }).click();
  let dialog = page.getByRole('dialog', { name: 'Grant Access To Atlas Research', exact: true });
  await dialog.getByRole('button', { name: 'User', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).count(), 1);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Change Plan' }).click();
  dialog = page.getByRole('dialog', { name: 'Change Atlas Research Plan', exact: true });
  assert.equal(await dialog.getByRole('button', { name: 'Plan', exact: true }).count(), 1);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Suspend Workspace', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Suspend Atlas Research', exact: true });
  assert.equal(await dialog.getByRole('textbox').getAttribute('aria-describedby'), 'workspace-confirmation-help');
  await dialog.getByRole('textbox').fill('Wrong name');
  assert.equal(await dialog.getByRole('button', { name: 'Suspend Workspace', exact: true }).isDisabled(), true);
  await page.goto(`${origin}/users/usr_maya`);
  await page.getByRole('button', { name: 'Grant Access', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Grant Workspace Access To Maya Chen', exact: true });
  assert.equal(await dialog.getByRole('button', { name: 'Workspace', exact: true }).count(), 1);
  assert.equal(await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).count(), 1);
  await page.goto(`${origin}/workspace-defaults`);
  await page.getByRole('tab', { name: 'Skills' }).click();
  await page.getByRole('button', { name: 'Import skill', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Import Skill', exact: true });
  assert.equal(await dialog.getByRole('button', { name: 'Provider', exact: true }).count(), 1);
  for (const name of ['Repository URL', 'Ref', 'Subpath']) assert.equal(await dialog.getByRole('textbox', { name, exact: true }).count(), 1);
}));

test('failed workspace Load more retries the same cursor without replacing retained rows', () => withPage(async (page, origin) => {
  let fail = true;
  const cursors = [];
  await page.route('**/admin-console-api/workspaces?*', route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('limit') === '100') return reply(route, { items: [] });
    const cursor = params.get('cursor');
    cursors.push(cursor);
    if (!cursor) return reply(route, { items: [workspace('first', 'First page')], nextCursor: 'next-page' });
    if (fail) return reply(route, { error: { message: 'Page unavailable' } }, 503);
    return reply(route, { items: [workspace('second', 'Second page')] });
  });
  await page.goto(`${origin}/workspaces`);
  await page.getByText('First page', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Load more' }).click();
  await page.getByText(/Page unavailable/).waitFor();
  assert.equal(await page.getByText('First page', { exact: true }).count(), 1);
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByText('Second page', { exact: true }).waitFor();
  assert.equal(await page.getByText('First page', { exact: true }).count(), 1);
  assert.deepEqual(cursors, [null, 'next-page', 'next-page']);
}));

test('revoking one membership refreshes the active workspace filter and panel count', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/users?workspace=Atlas`);
  await page.getByText('Ivy Tan', { exact: true }).click();
  await page.getByRole('button', { name: 'Revoke workspace access from Atlas Research', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Revoke access to Atlas Research?', exact: true });
  await dialog.getByRole('button', { name: 'Revoke Access', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('1 workspace', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close user details', exact: true }).click();
  await page.getByText('Showing 2 of 2', { exact: true }).waitFor();
  assert.equal(await page.getByText('Ivy Tan', { exact: true }).count(), 0);
}));
