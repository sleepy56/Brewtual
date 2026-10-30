const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Exercise the actual planner event handlers and rendered views without a browser dependency.
async function mountPlanner({ tasks = [], spaces = [], failTasks = false, mutation } = {}) {
  const state = [], refs = [], effects = [];
  let cursor = 0, first = true;
  const hooks = {
    ...React,
    useState(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useRef(initial) { const slot = cursor++; return refs[slot] ??= { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(fn) { if (first) effects.push(fn); },
  };
  const exports = {};
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const api = async (path, method, data) => {
    if (path === '/planner/tasks') { if (failTasks) throw new Error('Planner unavailable'); return tasks; }
    if (path === '/planner/spaces') return spaces;
    if (path === '/pairs/current') throw new ApiError('You are not in a pair', 403);
    if (mutation) return mutation(path, method, data);
    throw new Error(`Unexpected request: ${path}`);
  };
  const code = ts.transpileModule(readFileSync(require.resolve('../src/web/planner.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Intl, Date, Error, URLSearchParams,
    require(name) {
      if (name === 'react') return hooks;
      if (name === './client') return { api, ApiError };
      if (name === './brewtual-mark') return { BrewtualMark: () => React.createElement('svg') };
      if (name === './connections') return { Connections: () => React.createElement('p', null, 'Friend connections') };
      return require(name);
    },
  });
  const props = { account: { id: 'alice', email: 'alex@example.test' }, logout: async () => {}, theme: 'midnight', setTheme() {}, openLegacy() {} };
  let tree;
  const render = () => { cursor = 0; tree = exports.Planner(props); return renderToStaticMarkup(tree); };
  render(); first = false;
  effects.splice(0).forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  render();
  function all(node) {
    if (!React.isValidElement(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(all)];
  }
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (!React.isValidElement(node)) return '';
    return React.Children.toArray(node.props.children).map(text).join('');
  }
  return {
    html: render,
    navigate(label) {
      const nav = all(tree).find(node => node.type === 'nav' && node.props['aria-label'] === 'Main navigation');
      const button = all(nav).find(node => node.type === 'button' && text(node).endsWith(label));
      assert.ok(button, `Missing navigation item: ${label}`);
      button.props.onClick();
      return render();
    },
    click(label) {
      const button = all(tree).find(node => node.type === 'button' && text(node).includes(label));
      assert.ok(button, `Missing action: ${label}`);
      assert.ok(!button.props.disabled, `Action disabled: ${label}`);
      button.props.onClick();
      return render();
    },
  };
}

test('all personal sections open without a partner and the market explains its connection requirement', async () => {
  const planner = await mountPlanner();
  for (const [tab, heading] of [['Today','Your day. Your little rituals.'],['Task list','A little less on your mind.'],['Dailies','Small rituals. Steady rhythm.'],['Goals','Make room for something bigger.'],['Activity','Look how far you’ve come.']]) {
    const html = planner.navigate(tab);
    assert.ok(html.includes(heading), `Wrong view for ${tab}`);
    assert.ok(!html.includes('Invite your person.'), `${tab} was replaced by partner setup`);
  }
  assert.match(planner.navigate('Token market'), /Your market is waiting for company/);
  assert.match(planner.navigate('Together'), /Friend connections/);
  assert.match(planner.navigate('Settings'), /Your preferences/);
});

test('a solo user can open task and Daily creation, and token requests explain how to connect', async () => {
  const planner = await mountPlanner();
  planner.navigate('Task list');
  assert.match(planner.click('Add task'), /A new task/);
  const withTask = await mountPlanner({ tasks: [{id:'task',title:'Read a chapter',notes:'',kind:'TODO',target:1,progress:0,completed:false,rewarded:false,archived:false,weekdays:[1,2,3,4,5,6,7],timezone:'UTC',today:'2026-10-23',dueToday:true,dueOn:null,proposals:[]}] });
  withTask.navigate('Task list');
  assert.match(withTask.click('Ask for tokens'), /Your task still works on its own/);
});

test('one-person partner space does not gate personal pages, and each connected market has its own balance', async () => {
  const base={members:[{userId:'alice',user:{email:'alex@example.test'}}]};
  const waiting=await mountPlanner({spaces:[{...base,scopeKind:'PAIR',scopeId:'waiting',name:'Waiting pair',connected:false,balance:0}]});
  assert.match(waiting.navigate('Goals'), /Your longer-term goals/);
  assert.match(waiting.navigate('Token market'), /Your market is waiting for company/);
  const connected=await mountPlanner({spaces:[{...base,scopeKind:'PAIR',scopeId:'pair',name:'Our rituals',connected:true,balance:3},{...base,scopeKind:'GROUP',scopeId:'group1',name:'Group 1',connected:true,balance:5},{...base,scopeKind:'GROUP',scopeId:'group2',name:'Group 2',connected:true,balance:7}]});
  const market=connected.navigate('Token market');
  assert.match(market,/Partner · Our rituals · 3 tokens/);
  assert.match(market,/Group · Group 1 · 5 tokens/);
  assert.match(market,/Group · Group 2 · 7 tokens/);
  assert.match(market,/Only this space/);
});

test('settings stays accessible when the planner API is unavailable', async () => {
  const planner=await mountPlanner({failTasks:true});
  assert.match(planner.html(),/Planner unavailable/);
  assert.match(planner.navigate('Settings'),/Your preferences/);
});

test('install prompt is used once after dismissal and falls back to instructions', async () => {
  const state = [], effects = [];
  let cursor = 0, listener;
  const hooks = { ...React,
    useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial; return [state[slot], value => { state[slot] = value; }]; },
    useEffect(fn) { effects.push(fn); },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(require.resolve('../src/web/install-app.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, navigator: {}, window: { addEventListener(_name, fn) { listener = fn; }, removeEventListener() {} }, require(name) { return name === 'react' ? hooks : require(name); } });
  function render() { cursor = 0; return exports.InstallApp(); }
  render(); effects[0]();
  let calls = 0;
  listener({ preventDefault() {}, async prompt() { calls++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  await render().props.children[0].props.onClick();
  await render().props.children[0].props.onClick();
  assert.equal(calls, 1);
  assert.match(renderToStaticMarkup(render()), /Add to Home Screen/);
});

test('session restoration shows loading before the landing page', () => {
  const exports = {};
  const code = ts.transpileModule(readFileSync(require.resolve('../src/web/pair-habits.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const hooks = { ...React, useState: value => [value, () => {}], useEffect() {} };
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return hooks;
    if (name === './install-app') return { InstallApp: () => null };
    if (name.startsWith('./') || name.startsWith('../')) return {};
    return require(name);
  } });
  assert.match(renderToStaticMarkup(exports.default({})), /Opening your shared space/);
});

function mountPart(part, props, options = {}) {
  const state = [], calls = [];
  let cursor = 0;
  const hooks = { ...React, useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial; return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }]; } };
  const exports = {};
  const source = readFileSync(require.resolve('../src/web/planner.tsx'), 'utf8') + '\nexport { TaskForm, TokenRequest, Market };';
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const storage = new Map();
  vm.runInNewContext(code, { exports, Intl, Error, window: { confirm: () => true }, crypto: { randomUUID: () => 'retry-key' }, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, require(name) {
    if (name === 'react') return hooks;
    if (name === './client') return { api: async (...args) => { calls.push(args); if (options.fail?.()) throw new Error('Network interrupted'); } };
    if (name.startsWith('./')) return {};
    return require(name);
  } });
  let tree;
  function render() { cursor = 0; tree = exports[part](props); return tree; }
  function all(node) { if (!React.isValidElement(node)) return []; return [node, ...React.Children.toArray(node.props.children).flatMap(all)]; }
  function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); if (!React.isValidElement(node)) return ''; return React.Children.toArray(node.props.children).map(text).join(''); }
  return { calls, render, elements: () => all(render()), button(label) { const button = all(render()).find(n => n.type === 'button' && text(n).includes(label)); assert.ok(button, label); return button; }, input(index, value) { const input = all(render()).filter(n => n.type === 'input' || n.type === 'textarea')[index]; assert.ok(input); input.props.onChange({ target: { value, checked: value } }); }, submit() { const form = all(render()).find(n => n.type === 'form'); assert.ok(form); form.props.onSubmit({ preventDefault() {} }); } };
}

const taskFixture = { id: 'task', userId: 'alice', title: 'Read', notes: 'private', kind: 'TODO', timezone: 'UTC', weekdays: [1,2,3,4,5,6,7], dueOn: null, target: 1, progress: 0, archived: false, today: '2026-10-23', dueToday: true, completed: false, rewarded: false, proposals: [] };
const connectedSpace = { scopeKind: 'PAIR', scopeId: 'pair', name: 'Us', connected: true, balance: 20, members: [] };

test('task, daily, and goal forms submit their own fields and editing preserves private notes', () => {
  for (const [kind, target] of [['TODO', 1], ['DAILY', 1], ['GOAL', 10]]) {
    let saved;
    const form = mountPart('TaskForm', { task: null, kind, busy: false, error: '', save: data => { saved = data; } });
    form.input(0, `${kind} title`);
    form.input(1, 'private notes');
    form.submit();
    assert.equal(saved.kind, kind);
    assert.equal(saved.title, `${kind} title`);
    assert.equal(saved.notes, 'private notes');
    assert.equal(saved.target, target);
    assert.equal(saved.weekdays.length, 7);
    assert.ok(saved.timezone);
  }
  let saved;
  const form = mountPart('TaskForm', { task: taskFixture, kind: 'TODO', busy: false, error: '', save: data => { saved = data; } });
  form.input(0, 'Updated title');
  form.submit();
  assert.equal(saved.title, 'Updated title');
  assert.equal(saved.notes, 'private');
  assert.equal('kind' in saved, false);
});

test('token requests use the selected space and prevent duplicate pending requests', () => {
  let request;
  const form = mountPart('TokenRequest', { task: taskFixture, spaces: [connectedSpace], busy: false, error: '', save: (space, tokens) => { request = { space, tokens }; }, connect() {} });
  form.input(0, '12');
  form.submit();
  assert.equal(request.space.scopeId, 'pair');
  assert.equal(request.tokens, 12);
  const duplicate = mountPart('TokenRequest', { task: { ...taskFixture, proposals: [{ scopeId: 'pair', status: 'PENDING' }] }, spaces: [connectedSpace], busy: false, error: '', save() {}, connect() {} });
  assert.equal(duplicate.button('Send token request').props.disabled, true);
});

test('market approves requests and rewards, and redemption retries retain their key', async () => {
  const data = { balance: 20, members: [], proposals: [{ id: 'proposal', tokens: 4, status: 'PENDING', task: { ...taskFixture, userId: 'bob' } }], rewards: [{ id: 'pending', title: 'Tea', cost: 3, offeredById: 'bob', status: 'PENDING' }, { id: 'active', title: 'Coffee', cost: 5, offeredById: 'bob', status: 'ACTIVE' }], redemptions: [], ledger: [] };
  let fail = true, pending;
  const market = mountPart('Market', { account: { id: 'alice' }, space: connectedSpace, data, run: action => { pending = action().catch(() => {}); } }, { fail: () => { if (fail) { fail = false; return true; } return false; } });
  market.button('Approve 4').props.onClick(); await pending;
  market.button('Approve offer').props.onClick(); await pending;
  fail = true;
  market.button('Redeem for').props.onClick(); await pending;
  market.button('Redeem for').props.onClick(); await pending;
  assert.equal(market.calls[0][0], '/planner/requests/proposal/decide');
  assert.equal(market.calls[1][0], '/planner/rewards/pending/decide');
  assert.equal(market.calls[2][0], '/planner/rewards/active/redeem');
  assert.equal(market.calls[2][3], 'retry-key');
  assert.equal(market.calls[3][3], 'retry-key');
});

test('task completion, goal progress, and archive actions send the correct changes', async () => {
  const calls = [];
  const planner = await mountPlanner({ tasks: [taskFixture, { ...taskFixture, id: 'goal', kind: 'GOAL', title: 'Books', target: 10 }], mutation: async (...args) => { calls.push(args); } });
  planner.navigate('Task list');
  planner.click('Mark as done');
  await new Promise(resolve => setImmediate(resolve));
  planner.click('Archive');
  await new Promise(resolve => setImmediate(resolve));
  planner.navigate('Goals');
  planner.click('Log a step');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], '/planner/tasks/task/complete');
  assert.equal(calls[0][2].completed, true);
  assert.equal(calls[1][0], '/planner/tasks/task/archive');
  assert.equal(calls[1][2].archived, true);
  assert.equal(calls[2][0], '/planner/tasks/goal/progress');
  assert.equal(calls[2][2].delta, 1);
});

test('failed planner mutations show an error and allow a retry after refreshing', async () => {
  let attempts = 0;
  const planner = await mountPlanner({ tasks: [taskFixture], mutation: async () => { if (++attempts === 1) throw new Error('Connection lost'); } });
  planner.navigate('Task list');
  planner.click('Mark as done');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(planner.html(), /Connection lost/);
  planner.click('Mark as done');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 2);
  assert.match(planner.html(), /Saved\. One little step forward/);
});
