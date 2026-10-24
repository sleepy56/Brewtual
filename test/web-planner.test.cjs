const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Exercise the actual planner event handlers and rendered views without a browser dependency.
async function mountPlanner({ tasks = [], spaces = [], failTasks = false } = {}) {
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
  const api = async path => {
    if (path === '/planner/tasks') { if (failTasks) throw new Error('Planner unavailable'); return tasks; }
    if (path === '/planner/spaces') return spaces;
    throw new ApiError('You are not in a pair', 403);
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
