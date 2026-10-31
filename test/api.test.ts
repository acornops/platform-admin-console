import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdminApiError, loadAllPages, logoutAdmin } from '../src/api';

for (const status of [403, 503]) {
  test(`logout ${status} keeps the current page and reports failure`, async (t) => {
    const redirects: string[] = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { assign: (url: string) => redirects.push(url) } });
    t.after(() => previous ? Object.defineProperty(globalThis, 'location', previous) : Reflect.deleteProperty(globalThis, 'location'));
    t.mock.method(globalThis, 'fetch', async (url: string) => String(url).endsWith('/csrf')
      ? Response.json({ csrfToken: 'test-csrf' })
      : Response.json({ error: { message: 'unavailable' } }, { status }));
    await assert.rejects(logoutAdmin(), (error: unknown) => error instanceof AdminApiError && error.status === status);
    assert.deepEqual(redirects, []);
  });
}

test('successful logout redirects only after the response arrives', async (t) => {
  const redirects: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { assign: (url: string) => redirects.push(url) } });
  t.after(() => previous ? Object.defineProperty(globalThis, 'location', previous) : Reflect.deleteProperty(globalThis, 'location'));
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await logoutAdmin();
  assert.deepEqual(redirects, ['/']);
});

test('cursor cycles fail explicitly instead of fetching indefinitely', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls > 3) throw new Error('Test stopped unbounded traversal');
    return Response.json({ items: [{ id: String(calls) }], nextCursor: calls === 2 ? 'second' : 'first' });
  });
  await assert.rejects(loadAllPages('/users'), (error: unknown) => error instanceof AdminApiError && error.code === 'PAGINATION_INVALID');
  assert.equal(calls, 3);
});

test('finite pagination returns every page in order', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string) => String(url).includes('cursor=next')
    ? Response.json({ items: [{ id: 'two' }] })
    : Response.json({ items: [{ id: 'one' }], nextCursor: 'next' }));
  assert.deepEqual(await loadAllPages('/users?q=sample'), [{ id: 'one' }, { id: 'two' }]);
});
