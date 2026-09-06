import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createAdminConsoleServer } from '../server.mjs';

// CI may provide an explicit installed Playwright package path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const server = createAdminConsoleServer({ mode: 'mock' });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const mutations = [];
page.on('request', request => { if (request.method() !== 'GET' && /\/(?:plan|suspend|restore)$/.test(request.url())) mutations.push({ url: request.url(), body: request.postDataJSON() }); });
try {
  await page.goto(`${origin}/workspaces/ws_atlas`);
  await page.getByRole('heading', { name: 'Effective Limits And Usage' }).waitFor();
  for (const pool of ['Chat', 'Agent', 'Workflow', 'Auto Triage', 'Insights']) assert.ok(await page.getByText(pool, { exact: true }).count());
  await page.getByRole('button', { name: 'Change Plan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('option', { name: 'Starter' }).click();
  await page.getByRole('button', { name: 'Update Plan', exact: true }).click();
  await page.getByText('Retain existing resources and let active work drain under the new limits.', { exact: true }).waitFor();
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
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
