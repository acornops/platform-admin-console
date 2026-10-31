import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminConsoleServer } from '../server.mjs';
const playwright = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { chromium } = playwright.chromium ? playwright : playwright.default;

async function withPage(run) {
  const server = createAdminConsoleServer({ mode: 'mock' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const reads = [];
  page.on('request', request => { if (request.method() === 'GET') reads.push(new URL(request.url())); });
  try { await run(page, `http://127.0.0.1:${server.address().port}`, reads); }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

test('overview uses bounded summaries instead of catalog traversal', () => withPage(async (page, origin, reads) => {
  await page.goto(origin);
  await page.getByText('Platform Footprint', { exact: true }).waitFor();
  assert.equal(reads.filter(url => /\/admin-console-api\/(users|workspaces)$/.test(url.pathname)).length, 0);
  assert.equal(reads.filter(url => url.pathname.endsWith('/summary')).length, 2);
}));

test('workspace details do not wait for user discovery', () => withPage(async (page, origin, reads) => {
  await page.route('**/admin-console-api/users?*', route => route.fulfill({ status: 503, json: { error: { message: 'Directory unavailable' } } }));
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.locator('#workspace-panel-title').filter({ hasText: 'Atlas Research' }).waitFor();
  assert.equal(reads.filter(url => url.pathname === '/admin-console-api/users').length, 0);
}));

test('workspace status filtering stays cursor paginated', () => withPage(async (page, origin, reads) => {
  await page.goto(`${origin}/workspaces`);
  await page.getByRole('button', { name: 'Filter workspaces by status' }).click();
  await page.getByRole('option', { name: 'Suspended', exact: true }).click();
  await page.waitForTimeout(500);
  assert.ok(reads.some(url => url.pathname === '/admin-console-api/workspaces' && url.searchParams.get('lifecycleStatus') === 'suspended' && url.searchParams.get('limit') === '25'));
}));

test('bounded workspace suggestions preserve ID matching', () => withPage(async (page, origin, reads) => {
  await page.goto(`${origin}/users`);
  await page.getByRole('combobox', { name: 'Filter users by workspace' }).fill('ws_atlas');
  await page.getByRole('option', { name: /Atlas Research/ }).waitFor();
  assert.ok(reads.some(url => url.pathname === '/admin-console-api/workspaces' && url.searchParams.get('q') === 'ws_atlas' && url.searchParams.get('limit') === '8'));
}));

test('user details retain workspace names without a full workspace catalog', () => withPage(async (page, origin, reads) => {
  await page.goto(`${origin}/users/usr_maya`);
  await page.locator('#user-panel-title').filter({ hasText: 'Maya Chen' }).waitFor();
  await page.getByRole('button', { name: /^Atlas Research/ }).waitFor();
  const lookups = reads.filter(url => url.pathname === '/admin-console-api/workspaces');
  assert.ok(lookups.every(url => Number(url.searchParams.get('limit')) <= 25 && !url.searchParams.has('cursor')));
}));

test('grant selector pages and searches without choosing an existing member', () => withPage(async (page, origin) => {
  const reads = [];
  const grants = [];
  await page.route('**/admin-console-api/users?*', route => {
    const params = new URL(route.request().url()).searchParams;
    reads.push(params);
    const items = params.get('q') ? [{ id: 'late-user', displayName: 'Late User', email: 'late@example.test' }]
      : params.get('cursor') ? [{ id: 'page-two', displayName: 'Second Page', email: 'second@example.test' }]
        : [{ id: 'usr_maya', displayName: 'Maya Chen', email: 'maya@atlas.example' }, { id: 'first-user', displayName: 'First User', email: 'first@example.test' }];
    return route.fulfill({ json: { items, ...(!params.get('q') && !params.get('cursor') ? { nextCursor: 'next-page' } : {}) } });
  });
  await page.route('**/admin-console-api/workspaces/ws_atlas/members', route => {
    if (route.request().method() !== 'POST') return route.continue();
    grants.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: {} });
  });
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Manage Access' }).click();
  await page.getByRole('button', { name: 'Add workspace access' }).click();
  const dialog = page.getByRole('dialog', { name: 'Grant Access To Atlas Research', exact: true });
  await dialog.getByRole('button', { name: 'Load more users' }).click();
  await dialog.getByRole('button', { name: 'User', exact: true }).click();
  assert.equal(await page.getByRole('option', { name: /Maya Chen/ }).count(), 0);
  await page.getByRole('option', { name: /Second Page/ }).click();
  await dialog.getByRole('textbox', { name: 'Search users' }).fill('late');
  await page.waitForResponse(response => response.url().includes('q=late'));
  await dialog.getByRole('button', { name: 'User', exact: true }).click();
  await page.getByRole('option', { name: /Late User/ }).click();
  await dialog.getByRole('button', { name: 'Workspace Role', exact: true }).click();
  await page.getByRole('option', { name: 'Member', exact: true }).click();
  await dialog.getByRole('button', { name: 'Grant Access', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(grants[0].userId, 'late-user');
  assert.ok(reads.every(params => params.get('limit') === '25'));
}));

test('grant search ignores obsolete candidates and retries failed reads', () => withPage(async (page, origin) => {
  let oldRequest;
  let fail = true;
  await page.route('**/admin-console-api/users?*', route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    if (query === 'old') { oldRequest = route; return; }
    if (query === 'new' && fail) return route.fulfill({ status: 503, json: { error: { message: 'Search unavailable' } } });
    return route.fulfill({ json: { items: [{ id: 'new-user', displayName: 'New User', email: 'new@example.test' }] } });
  });
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Manage Access' }).click();
  await page.getByRole('button', { name: 'Add workspace access' }).click();
  const dialog = page.getByRole('dialog', { name: 'Grant Access To Atlas Research', exact: true });
  const search = dialog.getByRole('textbox', { name: 'Search users' });
  await search.fill('old');
  await page.waitForRequest(request => request.url().includes('q=old'));
  await search.fill('new');
  await dialog.getByText(/Search unavailable/).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Grant Access', exact: true }).isDisabled(), true);
  await oldRequest.fulfill({ json: { items: [{ id: 'old-user', displayName: 'Old User', email: 'old@example.test' }] } }).catch(() => {});
  fail = false;
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await dialog.getByRole('button', { name: 'User', exact: true }).click();
  assert.equal(await page.getByRole('option', { name: /Old User/ }).count(), 0);
  await page.getByRole('option', { name: /New User/ }).click();
}));
