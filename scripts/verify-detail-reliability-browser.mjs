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
  try { await run(page, `http://127.0.0.1:${server.address().port}`); }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

for (const [collection, first, second, heading, secondName] of [
  ['workspaces', 'ws_atlas', 'ws_cedar', '#workspace-panel-title', 'Cedar Systems'],
  ['users', 'usr_maya', 'usr_jules', '#user-panel-title', 'Jules Okafor']
]) {
  test(`${collection} ignore detail responses from an earlier navigation`, () => withPage(async (page, origin) => {
    let delayed;
    let payload;
    await page.route(`**/admin-console-api/${collection}/${first}`, async route => {
      payload = await (await route.fetch()).json();
      delayed = route;
    });
    await page.goto(`${origin}/${collection}/${first}`);
    await page.waitForFunction(() => document.querySelector('[role="dialog"]'));
    while (!delayed) await page.waitForTimeout(10);
    await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, `/${collection}/${second}`);
    await page.locator(heading).filter({ hasText: secondName }).waitFor();
    await delayed.fulfill({ json: payload }).catch(() => {});
    await page.waitForTimeout(150);
    assert.equal(await page.locator(heading).innerText(), secondName);
  }));

  test(`${collection} reset loaded detail and dialogs while the next selection loads`, () => withPage(async (page, origin) => {
    await page.goto(`${origin}/${collection}/${first}`);
    await page.locator(heading).filter({ hasText: collection === 'users' ? 'Maya Chen' : 'Atlas Research' }).waitFor();
    await page.route(`**/admin-console-api/${collection}/${second}`, () => {});
    await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, `/${collection}/${second}`);
    await page.waitForTimeout(100);
    assert.equal(await page.locator(heading).innerText(), collection === 'users' ? 'User Details' : 'Workspace Details');
    assert.equal(await page.getByRole('button', { name: 'Manage Access' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Grant Access', exact: true }).count(), 0);
  }));
}
