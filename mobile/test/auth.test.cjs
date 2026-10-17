const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function client(platform, fetch) {
  const stored = new Map();
  const exports = {};
  const source = ts.transpileModule(readFileSync(require.resolve('../src/auth/client.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const secureStore = {
    getItemAsync: async key => stored.get(key) ?? null,
    setItemAsync: async (key, value) => { stored.set(key, value); },
    deleteItemAsync: async key => { stored.delete(key); },
  };
  vm.runInNewContext(source, { exports, process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.com/api/v1' } },
    AbortSignal, fetch, require: name => name === 'react-native' ? { Platform: { OS: platform } } : secureStore });
  return { api: exports, stored };
}
const session = { accessToken: 'access', refreshToken: 'refresh-one', user: { id: 'alex', email: 'alex@example.com' } };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test('web uses credentialed requests and never persists credentials in native storage', async () => {
  const calls = [];
  const { api, stored } = client('web', async (url, options) => { calls.push({ url, options }); return response(session); });
  await api.signIn(' ALEX@example.com ', 'a password');
  await api.refreshSession();
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(JSON.parse(calls[0].options.body).email, 'alex@example.com');
  assert.deepEqual(JSON.parse(calls[1].options.body), { client: 'web' });
  assert.equal(stored.size, 0);
});

test('native saves only refresh credentials and preserves them after a network failure', async () => {
  let offline = false;
  const { api, stored } = client('android', async () => { if (offline) throw new Error('offline'); return response(session); });
  await api.signIn('alex@example.com', 'a password');
  assert.deepEqual([...stored.values()], ['refresh-one']);
  offline = true;
  await assert.rejects(api.refreshSession(), /Check your connection/);
  assert.deepEqual([...stored.values()], ['refresh-one']);
});

test('concurrent refreshes share one rotation and logout revokes the replacement token', async () => {
  let release;
  const calls = [];
  const { api, stored } = client('ios', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith('/refresh')) return new Promise(resolve => { release = () => resolve(response({ ...session, refreshToken: 'rotated' })); });
    return response(session);
  });
  await api.signIn('alex@example.com', 'a password');
  const first = api.refreshSession();
  assert.equal(first, api.refreshSession());
  const logout = api.signOut();
  await new Promise(resolve => setImmediate(resolve));
  release(); await first; await logout;
  assert.equal(calls.filter(call => call.url.endsWith('/refresh')).length, 1);
  assert.equal(calls.at(-1).body.refreshToken, 'rotated');
  assert.equal(stored.size, 0);
});

test('expired native refresh credentials are cleared and rejected', async () => {
  let status = 200;
  const { api, stored } = client('android', async () => response(session, status));
  await api.signIn('alex@example.com', 'a password'); status = 401;
  await assert.rejects(api.refreshSession(), error => error.status === 401);
  assert.equal(stored.size, 0);
});
