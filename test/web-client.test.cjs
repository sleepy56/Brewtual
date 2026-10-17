const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function client(fetch) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(require.resolve('../src/web/client.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, fetch, AbortSignal, Error, Response });
  return exports;
}
test('web uses cookie-backed sessions, memory access tokens and authenticated JSON requests', async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push([url, options]);
    return Response.json(
      url.endsWith('/login') ? { accessToken: 'memory-only', user: { id: 'alice' } } : [],
    );
  });
  assert.equal((await api.signIn('ALICE@EXAMPLE.COM', 'private-password')).id, 'alice');
  await api.api('/goals', 'POST', { title: 'Walk' });
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(JSON.parse(calls[0][1].body).client, 'web');
  assert.equal(calls[1][1].headers.Authorization, 'Bearer memory-only');
  assert.equal(calls[1][1].headers['Content-Type'], 'application/json');
});
test('parallel expired requests share one refresh and preserve redemption retry keys', async () => {
  let refreshes = 0;
  const calls = [];
  const api = client(async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/refresh')) {
      refreshes++;
      return Response.json({ accessToken: 'renewed', user: { id: 'alice' } });
    }
    return options.headers.Authorization === 'Bearer renewed'
      ? Response.json({ ok: true })
      : Response.json({}, { status: 401 });
  });
  await Promise.all([
    api.api('/wallet'),
    api.api('/rewards/id/redeem', 'POST', undefined, 'stable-redemption-key'),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(calls.filter(([url]) => url.endsWith('/redeem')).length, 2);
  assert.ok(
    calls
      .filter(([url]) => url.endsWith('/redeem'))
      .every(([, options]) => options.headers['Idempotency-Key'] === 'stable-redemption-key'),
  );
});
test('API failures reject instead of reporting a successful mutation', async () => {
  const api = client(async () =>
    Response.json({ message: 'Database is unavailable' }, { status: 503 }),
  );
  await assert.rejects(
    api.api('/goals', 'POST', { title: 'Walk' }),
    (error) => error.status === 503 && error.message === 'Database is unavailable',
  );
});
test('logout waits for an in-flight refresh before revoking the replacement session', async () => {
  const order = [];
  const api = client(async (url) => {
    order.push(url);
    return Response.json(
      url.endsWith('/refresh') ? { accessToken: 'renewed', user: { id: 'alice' } } : { ok: true },
    );
  });
  await Promise.all([api.refreshSession(), api.signOut()]);
  assert.deepEqual(order, ['/api/v1/auth/refresh', '/api/v1/auth/logout']);
});
