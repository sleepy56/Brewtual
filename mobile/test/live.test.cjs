const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(file, requires = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => requires[name] ?? {}, Intl, Date, URL });
  return exports;
}

test('live transport sends bearer, JSON and idempotency headers and retries one expired access token', async () => {
  const calls = [];
  let liveRequests = 0;
  const secure = { getItemAsync: async () => 'refresh', setItemAsync: async () => {}, deleteItemAsync: async () => {} };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/login')) return { ok: true, status: 201, json: async () => ({ accessToken: 'old-access', refreshToken: 'refresh', user: { id: 'a', email: 'a@example.com' } }) };
    if (url.endsWith('/auth/refresh')) return { ok: true, status: 201, json: async () => ({ accessToken: 'new-access', refreshToken: 'next', user: { id: 'a', email: 'a@example.com' } }) };
    liveRequests++;
    return liveRequests === 1
      ? { ok: false, status: 401, json: async () => ({ message: 'Expired' }) }
      : { ok: true, status: 201, json: async () => ({ id: 'saved' }) };
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(require.resolve('../src/auth/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.com/api/v1' } }, AbortSignal, fetch,
    require: name => name === 'react-native' ? { Platform: { OS: 'android' } } : secure });
  await exports.signIn('a@example.com', 'password');
  const result = await exports.apiRequest('/rewards/r1/redeem', 'POST', undefined, 'stable-retry-key');
  assert.equal(result.id, 'saved');
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer new-access');
  assert.equal(calls.at(-1).options.headers['Idempotency-Key'], 'stable-retry-key');
});

test('live API failures reject instead of reporting a successful mutation', async () => {
  const exports = {};
  const secure = { getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} };
  const source = ts.transpileModule(readFileSync(require.resolve('../src/auth/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.com/api/v1' } }, AbortSignal,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ message: 'Unavailable' }) }),
    require: name => name === 'react-native' ? { Platform: { OS: 'android' } } : secure });
  await assert.rejects(exports.apiRequest('/goals', 'POST', { title: 'Walk' }), error => error.status === 503 && error.message === 'Unavailable');
});

test('web defaults to same-origin API while native requires an explicit API URL', async () => {
  const urls = [];
  const webExports = {};
  const secure = { getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} };
  const source = ts.transpileModule(readFileSync(require.resolve('../src/auth/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports: webExports, process: { env: {} }, AbortSignal, fetch: async url => { urls.push(url); return { ok: true, status: 201, json: async () => ({ accessToken: 'a', user: { id: 'u', email: 'u@example.com' } }) }; },
    require: name => name === 'react-native' ? { Platform: { OS: 'web' } } : secure });
  await webExports.signIn('u@example.com', 'password');
  assert.equal(urls[0], '/api/v1/auth/login');
  const nativeExports = {};
  vm.runInNewContext(source, { exports: nativeExports, process: { env: {} }, AbortSignal, fetch: async () => { throw new Error('must not use relative native URLs'); },
    require: name => name === 'react-native' ? { Platform: { OS: 'android' } } : secure });
  await assert.rejects(nativeExports.signIn('u@example.com', 'password'), /Set EXPO_PUBLIC_API_URL/);
});

test('pair calendar handles timezone dates and Monday boundaries', () => {
  const calendar = loadTs('../src/live/calendar.ts');
  assert.equal(calendar.pairDate(new Date('2026-10-18T18:30:00Z'), 'Asia/Calcutta'), '2026-10-19');
  assert.equal(calendar.weekStart('2026-10-19'), '2026-10-19');
  assert.equal(calendar.addDays('2026-10-19', 6), '2026-10-25');
  assert.match(calendar.displayDate('2026-10-19', 'Asia/Calcutta'), /Monday, October 19/);
  assert.match(calendar.displayDate('2026-10-19', 'Pacific/Kiritimati'), /Monday, October 19/);
});

test('API mapping keeps pending approval and real member ownership', () => {
  const mapping = loadTs('../src/live/map.ts');
  const pair = { members: [{ slot: 1, user: { id: 'one', email: 'one@example.com' } }, { slot: 2, user: { id: 'two', email: 'two@example.com' } }] };
  const { byId, names } = mapping.members(pair);
  assert.equal(byId('two'), 'jamie');
  assert.equal(names.alex, 'one@example.com');
  assert.equal(mapping.mapGoal({ id: 'g', title: 'Read', description: null, ownerId: 'one', proposedById: 'two', status: 'PENDING', weekdays: [1, 3], requiredCount: 2, weeklyTokens: 4, startsOn: '2026-10-19', checkIns: [] }, byId, '2026-10-14').status, 'proposed');
});
