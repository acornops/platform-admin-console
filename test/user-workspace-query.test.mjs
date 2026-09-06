import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminConsoleServer } from '../server.mjs';
import { ALLOWED_ADMIN_SCOPES } from '../lib/admin-contract.mjs';

async function withServer(options, run) {
  const server = createAdminConsoleServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('mock workspace filtering matches name or ID, combines filters and preserves pagination', () => withServer({ mode: 'mock' }, async origin => {
  const read = async query => {
    const response = await fetch(`${origin}/admin-console-api/users?${query}`);
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await read('workspaceQuery=ATLAS&limit=1');
  assert.equal(first.items.length, 1);
  assert.ok(first.nextCursor);
  const second = await read(`workspaceQuery=ATLAS&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`);
  assert.notEqual(second.items[0].id, first.items[0].id);
  const byId = await read('workspaceQuery=ws_atlas&q=maya&emailVerified=true');
  assert.deepEqual(byId.items.map(user => user.id), ['usr_maya']);
  assert.deepEqual((await read('workspaceQuery=%25')).items, []);
}));

test('control-plane mode forwards only the additive filter and preserves upstream errors', () => {
  const urls = [];
  return withServer({ mode: 'control-plane', upstreamBaseUrl: 'https://control.example', upstreamToken: 'test-only', fetchImpl: async url => {
    urls.push(String(url));
    if (String(url).endsWith('/me')) return Response.json({ adminApiEnabled: true, scopes: ALLOWED_ADMIN_SCOPES });
    return Response.json({ error: { code: 'UNAVAILABLE', message: 'Retry user discovery' } }, { status: 503 });
  } }, async origin => {
    const response = await fetch(`${origin}/admin-console-api/users?workspaceQuery=Atlas&q=maya&emailVerified=true&limit=25&cursor=next`);
    assert.equal(response.status, 503);
    assert.ok(urls.includes('https://control.example/admin/v1/users?workspaceQuery=Atlas&q=maya&emailVerified=true&limit=25&cursor=next'));
    assert.equal((await response.json()).error.message, 'Retry user discovery');
    const denied = await fetch(`${origin}/admin-console-api/users?workspaceQuery=Atlas&targetId=secret`);
    assert.equal(denied.status, 400);
  });
});
