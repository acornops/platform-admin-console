import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import { createAdminConsoleServer } from '../server.mjs';

// CI may provide an explicit installed Playwright package path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
async function withPage(run, viewport = { width: 1440, height: 1000 }) {
  const server = createAdminConsoleServer({ mode: 'mock' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(5000);
  try { await run(page, origin); }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
const planDialog = page => page.getByRole('dialog', { name: /Change.*Plan/ });
async function selectPlan(page, name) {
  await planDialog(page).getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
}
const errorBody = (code, message) => ({ error: { code, message, retryable: false } });

for (const [width, theme] of [[1440, 'light'], [320, 'dark']]) {
  test(`plan preview compares lower/higher limits without reads or writes at ${width}px ${theme}`, () => withPage(async (page, origin) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const reads = [];
    const mutations = [];
    page.on('request', request => {
      if (request.url().includes('/admin-console-api/')) {
        if (request.method() !== 'GET') mutations.push(request);
        else if (/\/(?:policy|workspace-plans)$/.test(request.url())) reads.push(request.url());
      }
    });
    await page.route('**/admin-console-api/workspaces/ws_atlas/policy', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.usage.members = 53;
      body.usage.kubernetesClusters = 0;
      body.usage.virtualMachines = 0;
      body.quotaOverrides = { members: 100, kubernetesClusters: null };
      body.effectiveLimits.quotas = { members: 100, kubernetesClusters: 30, virtualMachines: null };
      body.usage.execution.chat = { concurrentRuns: 2, outstandingRuns: 3 };
      body.effectiveLimits.executionLimits.chat = { maxConcurrentRuns: 10, maxOutstandingRuns: 20 };
      await route.fulfill({ response, json: body });
    });
    await page.route('**/admin-console-api/workspace-plans', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.plans[0].limits = { members: 5, kubernetesClusters: 0, virtualMachines: null };
      body.plans[0].executionLimits.chat = { maxConcurrentRuns: 1, maxOutstandingRuns: 2 };
      body.plans[1].limits = { members: 60, kubernetesClusters: 50 }; // VM deliberately unavailable, not unlimited.
      await route.fulfill({ response, json: body });
    });
    await page.goto(`${origin}/workspaces/ws_atlas`);
    await page.getByRole('button', { name: 'Change Plan', exact: true }).click();
    const dialog = planDialog(page);
    const preview = dialog.getByRole('region', { name: 'Plan impact preview' });
    await preview.waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Update Plan', exact: true }).isDisabled(), true);
    await preview.getByText('Current plan selected. No plan change.', { exact: true }).waitFor();
    await selectPlan(page, 'Starter');
    const members = preview.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Members', exact: true }) });
    assert.match(await members.innerText(), /53[\s\S]*100[\s\S]*100[\s\S]*Default: 5[\s\S]*Override kept/);
    assert.doesNotMatch(await members.innerText(), /Above selected limit/);
    const clusters = preview.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Kubernetes Clusters', exact: true }) });
    assert.match(await clusters.innerText(), /0[\s\S]*30[\s\S]*0/);
    assert.doesNotMatch(await clusters.innerText(), /Override kept|Above selected limit/);
    await preview.getByText('Execution Pools', { exact: true }).click();
    const chat = preview.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Chat Concurrent', exact: true }) });
    assert.match(await chat.innerText(), /2[\s\S]*10[\s\S]*1[\s\S]*Above selected limit/);
    if (width === 320) {
      const selectedCell = await chat.locator('td').last().boundingBox();
      const warning = await chat.getByText('Above selected limit', { exact: true }).boundingBox();
      assert.ok(warning.x >= selectedCell.x + 100, 'overage explanation aligns under the selected value, not its label');
    }
    for (const pool of ['Agent', 'Workflow', 'Auto Triage', 'Insights']) {
      await preview.getByRole('rowheader', { name: `${pool} Concurrent`, exact: true }).waitFor();
      await preview.getByRole('rowheader', { name: `${pool} Outstanding`, exact: true }).waitFor();
    }
    await mkdir('test-results', { recursive: true });
    await chat.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/plan-impact-execution-${width}-${theme}.png` });
    assert.equal(await dialog.getByRole('checkbox').count(), 0, 'retain-existing stays behind authoritative server rejection');
    await preview.getByText('Execution Pools', { exact: true }).click();
    await selectPlan(page, 'Team');
    assert.match(await clusters.innerText(), /0[\s\S]*30[\s\S]*50/);
    const vms = preview.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Virtual Machines', exact: true }) });
    assert.match(await vms.innerText(), /0[\s\S]*Unlimited[\s\S]*Unavailable/);
    assert.equal(await preview.getByText('Above selected limit', { exact: true }).count(), 0);
    assert.equal(reads.length, 2, 'selection and rows reuse the initial reads');
    assert.equal(mutations.length, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await preview.getByRole('rowheader', { name: 'Members', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/plan-impact-${width}-${theme}.png` });
    await preview.getByRole('rowheader', { name: 'Virtual Machines', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/plan-impact-resources-${width}-${theme}.png` });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(mutations.length, 0);
  }, { width, height: width === 320 ? 568 : 1000 }));
}

test('resource overage preview warns without choosing the retain-existing exception', () => withPage(async (page, origin) => {
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Change Plan', exact: true }).click();
  await selectPlan(page, 'Starter');
  const preview = planDialog(page).getByRole('region', { name: 'Plan impact preview' });
  const vms = preview.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Virtual Machines', exact: true }) });
  assert.match(await vms.innerText(), /2[\s\S]*10[\s\S]*1[\s\S]*Above selected limit/);
  assert.equal(await planDialog(page).getByRole('checkbox').count(), 0);
}));

for (const failedRead of ['policy', 'workspace-plans']) test(`failed ${failedRead} read cannot expose a plan submission`, () => withPage(async (page, origin) => {
  await page.route(`**/admin-console-api/${failedRead === 'policy' ? 'workspaces/ws_atlas/policy' : 'workspace-plans'}`, route => route.fulfill({ status: 503, json: errorBody('UNAVAILABLE', 'Policy data unavailable') }));
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByText('Policy data unavailable', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Change Plan', exact: true }).count(), 0);
}));

test('stale policy blocks retries until refresh and submits only the newly reviewed target/version', () => withPage(async (page, origin) => {
  let reads = 0;
  const mutations = [];
  await page.route('**/admin-console-api/workspaces/ws_atlas/policy', async route => {
    reads += 1;
    if (reads === 2) return route.fulfill({ status: 503, json: errorBody('UNAVAILABLE', 'Refresh temporarily unavailable') });
    const response = await route.fetch();
    const body = await response.json();
    if (reads > 2) { body.policyVersion = 9; body.usage.members = 6; }
    await route.fulfill({ response, json: body });
  });
  await page.route('**/admin-console-api/workspaces/ws_atlas/plan', async route => {
    mutations.push(route.request().postDataJSON());
    return route.fulfill({ status: mutations.length === 1 ? 409 : 503, json: mutations.length === 1 ? errorBody('WORKSPACE_POLICY_VERSION_CONFLICT', 'Policy changed') : errorBody('UNAVAILABLE', 'Synthetic submission stopped') });
  });
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('button', { name: 'Change Plan', exact: true }).click();
  await selectPlan(page, 'Starter');
  const dialog = planDialog(page);
  const submit = dialog.getByRole('button', { name: 'Update Plan', exact: true });
  await submit.click();
  await dialog.getByText('Refresh temporarily unavailable', { exact: false }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  await dialog.locator('form').evaluate(form => form.requestSubmit());
  assert.equal(mutations.length, 1);
  await dialog.getByRole('button', { name: 'Refresh Policy', exact: true }).click();
  await dialog.getByText('Policy version 9.', { exact: false }).waitFor();
  assert.equal(mutations.length, 1, 'refresh is read-only');
  await selectPlan(page, 'Team');
  await submit.click();
  await dialog.getByText('Synthetic submission stopped', { exact: true }).waitFor();
  assert.equal(mutations[1].planKey, 'team');
  assert.equal(mutations[1].expectedPolicyVersion, 9);
  assert.equal(mutations[1].overLimitBehavior, 'reject');
  assert.notEqual(mutations[0].requestId, mutations[1].requestId);
  assert.deepEqual(Object.keys(mutations[1]).sort(), ['expectedPolicyVersion', 'overLimitBehavior', 'planKey', 'reason', 'requestId']);
}));

test('hosted policy preserves server-confirmed downgrade and exact-name hold actions', () => withPage(async (page, origin) => {
const mutations = [];
page.on('request', request => { if (request.method() !== 'GET' && /\/(?:plan|suspend|restore)$/.test(request.url())) mutations.push({ url: request.url(), body: request.postDataJSON() }); });
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('heading', { name: 'Effective Limits And Usage' }).waitFor();
  for (const pool of ['Chat', 'Agent', 'Workflow', 'Auto Triage', 'Insights']) assert.ok(await page.getByText(pool, { exact: true }).count());
  await page.getByRole('button', { name: 'Change Plan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('option', { name: 'Starter' }).click();
  await page.getByRole('button', { name: 'Update Plan', exact: true }).click();
  await page.getByText('Retain existing resources and let active work drain under the new limits.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  assert.equal(await page.getByRole('button', { name: 'Update Plan', exact: true }).isDisabled(), true);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Update Plan', exact: true }).click();
  await page.getByRole('dialog', { name: 'Change Atlas Research Plan', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(mutations[0].body.overLimitBehavior, 'reject');
  assert.equal(mutations[1].body.overLimitBehavior, 'retain_existing');
  assert.notEqual(mutations[0].body.requestId, mutations[1].body.requestId);
  await page.getByRole('button', { name: 'Suspend Workspace', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Suspend Workspace', exact: true }).isDisabled(), true);
  await page.getByRole('dialog').getByRole('textbox').fill('Atlas Research');
  await page.getByRole('dialog').getByRole('button', { name: 'Suspend Workspace', exact: true }).click();
  await page.getByRole('dialog', { name: 'Suspend Atlas Research', exact: true }).waitFor({ state: 'hidden' });
  await page.getByText('Admin hold', { exact: true }).waitFor();
  assert.equal(mutations.at(-1).body.source, 'admin');
  assert.equal(mutations.at(-1).body.expectedPolicyVersion, 1);
  await page.getByRole('button', { name: 'Restore Workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Atlas Research');
  await page.getByRole('dialog').getByRole('button', { name: 'Restore Workspace', exact: true }).click();
  await page.getByRole('dialog', { name: 'Restore Atlas Research', exact: true }).waitFor({ state: 'hidden' });
  await page.getByText('No active holds.', { exact: true }).waitFor();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/hosted-policy-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.screenshot({ path: 'test-results/hosted-policy-mobile.png', fullPage: true });
  console.log('Hosted policy browser checks passed: five pools, downgrade confirmation, versioned intents, exact-name admin hold actions and mobile overflow.');
}));
