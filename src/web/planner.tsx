'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Account } from './client';
import { BrewtualMark } from './brewtual-mark';
import { Connections } from './connections';
import { SharedNotes } from './shared-notes';
import { ThemePicker } from './appearance';
import { AppIcon } from './app-icon';
import type { Pair } from './types';
import type { PlannerSpace, PersonalTask, MarketData } from './planner-types';

type Tab = 'today' | 'tasks' | 'dailies' | 'goals' | 'notes' | 'market' | 'together' | 'activity' | 'settings';
const tabs: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'tasks', label: 'Task list' },
  { id: 'dailies', label: 'Dailies' }, { id: 'goals', label: 'Goals' },
  { id: 'notes', label: 'Shared notes' },
  { id: 'market', label: 'Token market' }, { id: 'together', label: 'Together' },
  { id: 'activity', label: 'Activity' }, { id: 'settings', label: 'Settings' },
];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const kindName = { TODO: 'Task', DAILY: 'Daily', GOAL: 'Goal' };
const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Could not save. Try again.';
const spaceKey = (space: Pick<PlannerSpace, 'scopeKind' | 'scopeId'>) => `${space.scopeKind}:${space.scopeId}`;
const spaceLabel = (space: PlannerSpace) => `${space.scopeKind === 'PAIR' ? 'Partner' : 'Group'} · ${space.name}`;

export function Planner({ account, logout, theme, setTheme, openLegacy }: {
  account: Account; logout: () => Promise<void>; theme: string; setTheme: (value: string) => void; openLegacy: () => void;
}) {
  const [tab, setTab] = useState<Tab>('today');
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [spaces, setSpaces] = useState<PlannerSpace[]>([]);
  const [pair, setPair] = useState<Pair | null>(null);
  const [spaceError, setSpaceError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [creating, setCreating] = useState<PersonalTask['kind'] | null>(null);
  const [editing, setEditing] = useState<PersonalTask | null>(null);
  const [requesting, setRequesting] = useState<PersonalTask | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showComplete, setShowComplete] = useState(true);
  const [selected, setSelected] = useState('personal');
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [createMenu, setCreateMenu] = useState(false);
  const pending = useRef(false);
  const notesPending = useRef(false);
  const reportNotesPending = useCallback((value: boolean) => { notesPending.current = value; }, []);
  const marketRequest = useRef(0);
  const plannerRequest = useRef(0);
  const sectionRef = useRef('personal');
  const selectedSpace = spaces.find(space => spaceKey(space) === selected);
  const refresh = useCallback(async () => {
    const request = ++plannerRequest.current;
    const [scopeKind, scopeId] = sectionRef.current.split(':');
    const taskPath = sectionRef.current === 'personal' ? '/planner/tasks' : `/planner/tasks?scopeKind=${scopeKind}&scopeId=${scopeId}`;
    // Personal planning remains available when a social-space request fails.
    const [taskResult, spaceResult, pairResult] = await Promise.allSettled([
      api<PersonalTask[]>(taskPath), api<PlannerSpace[]>('/planner/spaces'), api<Pair>('/pairs/current'),
    ]);
    if (request !== plannerRequest.current) return;
    if (spaceResult.status === 'fulfilled') { setSpaces(spaceResult.value); setSpaceError(''); }
    else { setSpaces([]); setSpaceError(errorMessage(spaceResult.reason)); }
    setPair(pairResult.status === 'fulfilled' ? pairResult.value : null);
    if (taskResult.status === 'rejected') {
      if (taskResult.reason instanceof ApiError && taskResult.reason.status === 401) await logout();
      throw taskResult.reason;
    }
    setTasks(taskResult.value); setLoaded(true); setStale(false);
  }, [account.id, selected]);
  const loadMarket = useCallback(async (space: PlannerSpace | undefined) => {
    const request = ++marketRequest.current;
    setMarket(null); setMarketError('');
    if (!space?.connected) { setMarketLoading(false); return; }
    setMarketLoading(true);
    try {
      const data = await api<MarketData>(`/planner/market?scopeKind=${space.scopeKind}&scopeId=${space.scopeId}`);
      if (request === marketRequest.current) setMarket(data);
    } catch (e) { if (request === marketRequest.current) setMarketError(errorMessage(e)); }
    finally { if (request === marketRequest.current) setMarketLoading(false); }
  }, []);
  useEffect(() => { void refresh().catch(e => { setError(errorMessage(e)); setStale(true); }); }, [refresh]);
  useEffect(() => {
    if (tab === 'market' || tab === 'activity') void loadMarket(selectedSpace);
    else { ++marketRequest.current; setMarket(null); }
  }, [tab, selectedSpace?.scopeKind, selectedSpace?.scopeId, selectedSpace?.connected]);
  async function run(action: () => Promise<unknown>, after?: () => void) {
    if (pending.current || stale) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await action();
      after?.();
      try {
        await refresh();
        if (tab === 'market' || tab === 'activity') await loadMarket(selectedSpace);
        setNotice('Saved. One little step forward.');
      } catch (e) { setStale(true); setError(`Your change was saved, but the latest view could not load. Refresh before making another change. ${errorMessage(e)}`); }
    } catch (e) {
      setError(errorMessage(e));
      // Reload after an uncertain response before allowing another write.
      try { await refresh(); } catch { setStale(true); }
    } finally { pending.current = false; setBusy(false); }
  }
  const activeTasks = tasks.filter(task => task.archived === showArchived && (showComplete || !task.completed));
  const todaysTasks = tasks.filter(task => !task.archived && task.kind === 'DAILY' && task.dueToday);
  const todayComplete = todaysTasks.filter(task => task.completed).length;
  const focusTasks = tasks.filter(task => !task.archived && (task.kind === 'DAILY' ? task.dueToday : !task.completed && (!task.dueOn || task.dueOn <= task.today)));
  const upcomingTasks = tasks.filter(task => !task.archived && task.kind !== 'DAILY' && !task.completed && task.dueOn && task.dueOn > task.today).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  const completedTasks = tasks.filter(task => !task.archived && task.completed && task.kind !== 'DAILY');
  const title = { today: 'Your day. Your little rituals.', tasks: 'A little less on your mind.', dailies: 'Small rituals. Steady rhythm.', goals: 'Make room for something bigger.', notes: 'A place to think together.', market: 'Little wins. Shared rewards.', together: 'Your people, in your corner.', activity: 'Look how far you’ve come.', settings: 'Make yourself at home.' }[tab];
  function selectSection(value: string) {
    if (pending.current || value === selected || (notesPending.current && !window.confirm('Leave this note? Unsaved changes will be lost.'))) return;
    sectionRef.current = value;
    ++plannerRequest.current; setSelected(value); setTasks([]); setLoaded(false); setError(''); setNotice(''); setShowArchived(false);
    if (value === 'personal' && ['market','activity','notes'].includes(tab)) setTab('today');
  }
  function navigate(next: Tab) {
    if (pending.current || next === tab || (notesPending.current && !window.confirm('Leave this note? Unsaved changes will be lost.'))) return;
    if (['market','activity','notes'].includes(next) && selected === 'personal' && spaces.length) {
      const space = spaces.find(item => item.connected) ?? spaces[0];
      sectionRef.current = spaceKey(space);
      ++plannerRequest.current; setSelected(spaceKey(space)); setTasks([]);
    }
    setTab(next); if (!stale) setError(''); setNotice(''); setShowArchived(false);
  }
  function focusCard(task: PersonalTask) {
    const own = task.userId === account.id;
    const tokens = task.proposals.filter(item => item.status === 'ACTIVE' && (!selectedSpace || (item.scopeKind === selectedSpace.scopeKind && item.scopeId === selectedSpace.scopeId))).reduce((sum, item) => sum + item.tokens, 0);
    return <article className={`focus-card ${task.completed ? 'focus-complete' : ''}`} key={task.id}>
      <button className="focus-copy" disabled={!own} onClick={() => setEditing(task)} aria-label={`${own ? 'Edit' : 'Shared task:'} ${task.title}`}>
        <span className="focus-title"><AppIcon name={task.kind === 'DAILY' ? 'dailies' : task.kind === 'GOAL' ? 'goals' : 'tasks'}/><span>{task.title}</span></span>
        <span className="focus-meta">
          {task.kind === 'DAILY' ? <><span>{task.weekdays.length === 7 ? 'Every day' : `${task.weekdays.length} days a week`}</span><span className="schedule-dots" role="img" aria-label={`Scheduled ${task.weekdays.map(day => days[day - 1]).join(', ')}`}>{days.map((day, index) => <i key={day} className={task.weekdays.includes(index + 1) ? 'scheduled' : ''}/>)}</span></> : <span>{task.kind === 'GOAL' ? `${task.progress} / ${task.target} steps` : task.dueOn ? `Due ${task.dueOn}` : 'At your own pace'}</span>}
          {tokens > 0 && <span className="focus-tokens"><AppIcon name="token"/>{tokens}</span>}
          {task.rewarded && <span>Tokens earned</span>}
          {!own && <span>{task.ownerEmail}</span>}
        </span>
      </button>
      <button className={`focus-check ${task.completed ? 'is-checked' : ''}`} aria-label={task.kind === 'GOAL' ? `Log a step for ${task.title}` : `${task.completed ? 'Undo' : 'Complete'} ${task.title}`} aria-pressed={task.completed} disabled={!own || task.rewarded || (task.kind === 'GOAL' && task.completed)} onClick={() => void run(() => task.kind === 'GOAL' ? api(`/planner/tasks/${task.id}/progress`, 'POST', { delta: 1 }) : api(`/planner/tasks/${task.id}/complete`, 'POST', { completed: !task.completed }))}>
        {task.completed ? <AppIcon name="check"/> : task.kind === 'GOAL' ? <AppIcon name="plus"/> : null}
      </button>
    </article>;
  }
  function taskCard(task: PersonalTask) {
    const own = task.userId === account.id;
    return <article className={`card planner-task ${task.completed ? 'task-finished' : ''}`} key={task.id}>
      <div className="row between"><div className="task-copy"><p className="eyebrow">{kindName[task.kind]} {task.kind === 'DAILY' && !task.dueToday ? '· REST DAY' : ''}</p><h3>{task.title}</h3>
        {task.notes && <p className="muted small task-notes">{task.notes}</p>}
        {task.dueOn && <p className="small muted">{task.dueOn < task.today && !task.completed ? 'Overdue · ' : 'Due · '}{task.dueOn}</p>}
        {task.kind === 'DAILY' && <p className="small muted">{task.weekdays.map(day => days[day - 1]).join(' · ')} · {task.timezone}</p>}
      </div><span className={`task-kind-mark kind-${task.kind.toLowerCase()}`}><AppIcon name={task.kind === 'TODO' ? 'tasks' : task.kind === 'DAILY' ? 'dailies' : 'goals'}/></span></div>
      {task.kind === 'GOAL' && <><div className="row between small muted"><span>{task.progress} / {task.target} steps</span><span>{Math.round(task.progress / task.target * 100)}%</span></div><progress value={task.progress} max={task.target}/></>}
      {own ? <div className="row task-actions">
        {task.archived ? <button className="primary" onClick={() => void run(() => api(`/planner/tasks/${task.id}/archive`, 'POST', { archived: false }))}>Restore</button> : task.kind === 'GOAL' ? <>
          <button className="primary" disabled={task.completed} onClick={() => void run(() => api(`/planner/tasks/${task.id}/progress`, 'POST', { delta: 1 }))}>{task.completed ? '✓ Goal reached' : '＋ Log a step'}</button>
          <button className="subtle" disabled={!task.progress || task.rewarded} onClick={() => void run(() => api(`/planner/tasks/${task.id}/progress`, 'POST', { delta: -1 }))}>Undo step</button>
        </> : <button className={task.completed ? 'subtle' : 'primary'} disabled={task.rewarded || (task.kind === 'DAILY' && !task.dueToday)} aria-pressed={task.completed} onClick={() => void run(() => api(`/planner/tasks/${task.id}/complete`, 'POST', { completed: !task.completed }))}>{task.completed ? task.rewarded ? '✓ Completed · tokens earned' : '✓ Done · Undo' : task.kind === 'DAILY' && !task.dueToday ? 'Not due today' : 'Mark as done'}</button>}
        {!task.archived && <button className="subtle" disabled={task.kind !== 'DAILY' && task.completed} onClick={() => setRequesting(task)}>✧ Ask for tokens</button>}
        <button className="text-button" onClick={() => setEditing(task)}>Edit</button>
        {!task.archived && <button className="text-button" onClick={() => void run(() => api(`/planner/tasks/${task.id}/archive`, 'POST', { archived: true }))}>Archive</button>}
      </div> : <p className="small muted shared-task-owner">{task.ownerEmail} · {task.completed ? 'Completed' : 'In progress'} · Only the owner can update this task.</p>}
      {!!task.proposals.length && <div className="task-proposals">{task.proposals.map(proposal => <span key={proposal.id} className="status">{spaces.find(space => space.scopeId === proposal.scopeId)?.name ?? (proposal.scopeKind === 'PAIR' ? 'Partner' : 'Group')} · {proposal.tokens} ✧ · {proposal.status === 'ACTIVE' ? 'Approved' : proposal.status === 'PENDING' ? 'Awaiting approval' : 'Declined'}</span>)}</div>}
      {task.rewarded && <p className="small muted">Token-backed completions are final, so earned tokens cannot be collected twice.</p>}
    </article>;
  }
  function collection(kind: PersonalTask['kind'], heading: string) {
    const items = activeTasks.filter(task => task.kind === kind);
    return <><div className="section-heading"><h2>{heading}</h2><button className="primary" onClick={() => setCreating(kind)}>＋ Add {kindName[kind].toLowerCase()}</button></div>
      <div className="collection-overview"><span><strong>{tasks.filter(task => task.kind === kind && !task.archived && !task.completed).length}</strong> {kind === 'DAILY' ? 'in your rhythm' : 'in progress'}</span><span><strong>{tasks.filter(task => task.kind === kind && !task.archived && task.completed).length}</strong> {kind === 'DAILY' ? 'done today' : 'completed'}</span></div>
      <div className="row collection-filters"><label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/> Archived</label><label><input type="checkbox" checked={showComplete} onChange={e => setShowComplete(e.target.checked)}/> Show completed</label><span>{items.length} shown</span></div>
      <div className={kind === 'GOAL' ? 'planner-goal-grid' : ''}>{items.map(taskCard)}</div>
      {!items.length && <section className="empty"><AppIcon name={kind === 'TODO' ? 'tasks' : kind === 'DAILY' ? 'dailies' : 'goals'}/><h2>{showArchived ? 'No archived items here.' : kind === 'TODO' ? 'A clear list. A fresh start.' : kind === 'DAILY' ? 'A rhythm that works for you.' : 'Every big thing starts small.'}</h2><p className="muted">{showArchived ? 'Archived items can be restored whenever you need them.' : kind === 'DAILY' ? 'Choose the days, add your ritual, and check it off when you show up.' : kind === 'GOAL' ? 'Give your goal a target and build progress one step at a time.' : 'Add a task, set an optional due date, and make a little space in your day.'}</p>{!showArchived && <button className="subtle" onClick={() => setCreating(kind)}>Add {kindName[kind].toLowerCase()}</button>}</section>}
    </>;
  }
  const selector = <label className="market-selector">Token space<select aria-label="Token space" value={selectedSpace ? spaceKey(selectedSpace) : ''} onChange={e => selectSection(e.target.value)}>{spaces.map(space => <option value={spaceKey(space)} key={spaceKey(space)}>{spaceLabel(space)} · {space.balance} tokens{space.connected ? '' : ' · Waiting for someone'}</option>)}</select></label>;
  return <div className={`workspace planner-workspace ${tab === 'today' ? 'planner-home' : ''}`}><aside className="sidebar"><a href="/" className="brand"><BrewtualMark/><span>brewtual</span></a><p className="eyebrow">A LITTLE BETTER, TOGETHER</p><button className="primary sidebar-create" aria-label="Create something" disabled={busy || stale || !loaded} onClick={() => setCreateMenu(true)}><AppIcon name="plus"/>New item</button><nav aria-label="Main navigation">{tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><span><AppIcon name={item.id}/></span>{item.label}</button>)}</nav><div className="sidebar-foot"><ThemePicker theme={theme} setTheme={setTheme} compact/><p className="small muted">{account.email}</p></div></aside>
    <div className="main-column"><header className="topbar"><div className="space-identity"><button className="space-art" aria-label="Open your shared spaces" onClick={() => navigate('together')}><AppIcon name={selectedSpace ? 'together' : 'tasks'}/></button><details className="section-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary aria-label={`Choose section: ${selectedSpace?.name ?? 'Personal'}`}><span><strong>{selectedSpace?.name ?? 'Personal'}</strong><small>{selectedSpace ? selectedSpace.scopeKind === 'PAIR' ? 'Partner · Shared tasks' : 'Group · Shared tasks' : 'All your tasks'}</small></span><span className="section-chevron" aria-hidden="true">⌄</span></summary><nav className="section-options" aria-label="Task sections"><p className="eyebrow">YOUR SECTIONS</p>{[{key:'personal',name:'Personal',description:'All your tasks, in one place',icon:'tasks' as const},...spaces.map(space=>({key:spaceKey(space),name:space.name,description:space.scopeKind==='PAIR'?'Partner · Shared tasks':'Group · Shared tasks',icon:'together' as const}))].map(section=><button key={section.key} disabled={busy} aria-pressed={selected===section.key} onClick={event=>{selectSection(section.key);const menu=event.currentTarget.closest('details'); menu?.removeAttribute('open'); menu?.querySelector('summary')?.focus();}}><span className="section-option-icon"><AppIcon name={section.icon}/></span><span><strong>{section.name}</strong><small>{section.description}</small></span><span className="section-selected">{selected===section.key&&<AppIcon name="check"/>}</span></button>)}</nav></details></div><div className="header-actions"><button className="header-icon" aria-label="Activity and token history" onClick={() => navigate('activity')}><AppIcon name="activity"/></button><button className="avatar" aria-label="Account settings" onClick={() => navigate('settings')}>{account.email.slice(0,1).toUpperCase()}</button></div></header>
    <main className="content"><div className="page-heading"><div><p className="eyebrow">YOUR LITTLE SPACE / {tabs.find(item => item.id === tab)?.label.toUpperCase()}</p><h1>{tab === 'today' ? title : tabs.find(item => item.id === tab)?.label}</h1><p className="page-description muted">{tab !== 'today' && title}</p></div><button className="subtle refresh-planner" aria-label="Refresh planner" disabled={busy} onClick={() => void refresh().then(() => { setError(''); if (tab === 'market' || tab === 'activity') return loadMarket(selectedSpace); }).catch(e => setError(errorMessage(e)))}><AppIcon name="dailies"/><span>Refresh</span></button></div>
      {error && <div className="notice error" role="alert">{error}</div>}{notice && <div className="notice success" role="status">{notice}</div>}
      {spaceError && <div className="notice error" role="alert">Shared spaces could not load: {spaceError}. Your personal planner is still available.</div>}
      {!loaded && !['settings','together'].includes(tab) && !(tab === 'notes' && stale) ? <p role="status">{error ? 'Your planner could not load. Use Refresh to try again.' : 'Opening your planner…'}</p> : <fieldset disabled={busy || (stale && tab !== 'together' && tab !== 'notes')} aria-busy={busy}>
      {tab === 'today' && <><div className="home-balances">
        <button className="balance-card" onClick={() => navigate(spaces.length ? 'market' : 'together')}><span className="balance-value"><AppIcon name="token"/>{selectedSpace?.balance ?? spaces.reduce((sum, space) => sum + space.balance, 0)}</span><span className="balance-tag">tokens</span><span className="balance-label">Your little wins</span><span className="balance-caption">{selectedSpace?.name ?? (spaces.length ? 'Across your shared spaces' : 'Connect to earn together')}</span></button>
        <button className="balance-card" onClick={() => navigate('dailies')}><span className="balance-value"><AppIcon name="goals"/>{todayComplete}<small>/{todaysTasks.length}</small></span><span className="balance-tag">today</span><span className="balance-label">Your daily rhythm</span><span className="balance-caption">{todaysTasks.length ? `${todayComplete} of ${todaysTasks.length} done today` : 'Make room for a little ritual'}</span></button>
      </div>
        <button className="together-banner" onClick={() => navigate('together')}><span><strong>{todaysTasks.length > 0 && todayComplete === todaysTasks.length ? 'A perfect little day!' : theme === 'cozy' ? 'Better days, brewed together.' : 'Small steps. Shared wins.'}</strong><small>{todaysTasks.length > 0 && todayComplete === todaysTasks.length ? 'All your Dailies are done. Enjoy this moment.' : pair ? 'A little encouragement goes a long way.' : 'A space for you. Even better with your person.'}</small></span><span className="banner-heart"><AppIcon name="together"/></span></button>
        <section className="focus-section" aria-labelledby="focus-heading"><div className="section-heading"><h2 id="focus-heading">Today’s focus</h2><button className="text-button" onClick={() => setCreating('DAILY')}>＋ Add a ritual</button></div>
          {focusTasks.length ? focusTasks.map(focusCard) : <div className="focus-empty"><span aria-hidden="true">✧</span><h3>A little space for something good.</h3><p>Add a task or start a ritual. Your own pace is a good pace.</p><button className="subtle" onClick={() => setCreating('TODO')}>Add your first task</button></div>}
        </section>
        {!!upcomingTasks.length && <section className="focus-section" aria-labelledby="upcoming-heading"><div className="section-heading"><h2 id="upcoming-heading">Coming up</h2><span className="small muted">A little at a time</span></div>{upcomingTasks.map(focusCard)}</section>}
        {!!completedTasks.length && <section className="focus-section" aria-labelledby="wins-heading"><div className="section-heading"><h2 id="wins-heading">Your little wins</h2><span className="small muted">Look at you go</span></div>{completedTasks.map(focusCard)}</section>}
        <p className="home-footnote">A little better, together. <span aria-hidden="true">♡</span></p>
      </>}
      {tab === 'tasks' && collection('TODO','Your task list')}{tab === 'dailies' && collection('DAILY','Your recurring rituals')}{tab === 'goals' && collection('GOAL','Your longer-term goals')}
      {tab === 'notes' && <SharedNotes spaces={spaces} userId={account.id} initialSpace={selectedSpace ? spaceKey(selectedSpace) : ''} onSpaceChange={selectSection} onPendingChange={reportNotesPending} connect={() => navigate('together')}/>}
      {(tab === 'market' || tab === 'activity') && <>{!!spaces.length && selector}{!selectedSpace?.connected ? <section className="empty market-locked"><AppIcon name="market"/><h2>Your market is waiting for company.</h2><p className="muted">Connect with a partner or have at least two people in a friend group to unlock its token market. Your personal planner is ready to use now.</p><button className="primary" onClick={()=>navigate('together')}>Find your together →</button></section> : <>
        <section className="market-balance card row between"><div><p className="eyebrow">{spaceLabel(selectedSpace)}</p><h2>{market?.balance ?? selectedSpace.balance} <span className="accent">tokens</span></h2><p className="small muted">Only this space’s tokens can be spent here.</p></div><span className="market-balance-symbol"><AppIcon name="token"/></span></section>
        {marketLoading && <p role="status">Loading this space’s market…</p>}{marketError && <p role="alert" className="notice error">{marketError}</p>}
        {market && (tab === 'activity' ? <><h2>Token history</h2>{market.ledger.map(item=><article className="ledger-row" key={item.id}><div><h3>{item.reason === 'TASK_AWARD' ? 'Approved task completed' : item.reason === 'WEEKLY_AWARD' ? 'Weekly partner habit award' : 'Reward redeemed'}</h3><p className="muted small">{new Date(item.createdAt).toLocaleDateString()}</p></div><strong className="accent">{item.amount>0?'+':''}{item.amount} ✧</strong></article>)}{!market.ledger.length&&<p className="muted">Completed, approved tasks will write your first little win here.</p>}</> : <Market key={spaceKey(selectedSpace)} account={account} space={selectedSpace} data={market} run={run}/>)}
      </>}</>}
      {tab === 'together' && <><section className="card together-intro"><span className="intro-symbol"><AppIcon name="together"/></span><div><h2>A space for your people.</h2><p className="muted">Shared routines with your person. A cheering section with your friends. Start a space or join one below.</p></div></section><Connections userId={account.id} pairId={pair?.pair.id} partnerEmail={pair?.members.find(member => member.user.id !== account.id)?.user.email} reload={refresh} openNotes={(kind, id) => { navigate('notes'); selectSection(`${kind}:${id}`); }}/>{!pair && <fieldset disabled={busy || stale}><PartnerSpace run={run}/></fieldset>}</>}
      </fieldset>}
      {tab === 'settings' && <section className="card settings"><h2>Your preferences</h2><p className="muted small appearance-intro">Set the mood for your shared space. You can change it any time.</p><ThemePicker theme={theme} setTheme={setTheme}/><p className="muted">{account.email}</p><div className="row"><button className="subtle" onClick={()=>navigate('together')}>＋ Invite or join</button><button className="subtle" onClick={openLegacy}>Previous partner habits & rewards</button><button className="subtle" onClick={()=>void logout()}>Sign out</button></div></section>}
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {(['today','goals','add','market'] as const).map(item => item === 'add' ? <button key={item} className="nav-add" aria-label="Create something" disabled={busy || stale || !loaded} onClick={() => setCreateMenu(true)}><AppIcon name="plus"/></button> : <button key={item} aria-label={item === 'today' ? 'Today' : item === 'goals' ? 'Goals' : 'Token market'} aria-current={tab === item ? 'page' : undefined} onClick={() => navigate(item)}><AppIcon name={item}/><span>{item === 'today' ? 'Today' : item === 'goals' ? 'Goals' : 'Market'}</span></button>)}
      <details className="section-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary aria-label="More sections" aria-current={!['today','goals','market'].includes(tab) ? 'page' : undefined}><AppIcon name="menu"/><span>More</span></summary><nav aria-label="All sections">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={event => { navigate(item.id); const menu=event.currentTarget.closest('details'); menu?.removeAttribute('open'); menu?.querySelector('summary')?.focus(); }}><AppIcon name={item.id}/>{item.label}</button>)}</nav></details>
    </nav></div>
    {createMenu && <PlannerDialog title="Make room for a little progress." close={() => setCreateMenu(false)}><p className="muted small">What would you like to add?</p><div className="create-options">{(['TODO', 'DAILY', 'GOAL'] as const).map(kind => <button key={kind} className="subtle" onClick={() => { setCreateMenu(false); setCreating(kind); }}><AppIcon name={kind === 'TODO' ? 'tasks' : kind === 'DAILY' ? 'dailies' : 'goals'}/><span><strong>{kindName[kind]}</strong><small>{kind === 'TODO' ? 'One thing to get done' : kind === 'DAILY' ? 'A ritual worth repeating' : 'Something bigger, one step at a time'}</small></span><span aria-hidden="true">＋</span></button>)}</div></PlannerDialog>}
    {(creating || editing) && <PlannerDialog title={editing ? `Edit your ${kindName[editing.kind].toLowerCase()}` : `A new ${kindName[creating!].toLowerCase()}`} close={()=>{if(!busy){setCreating(null);setEditing(null);}}}><TaskForm spaces={spaces} sharingAvailable={!spaceError} initialSpace={selectedSpace} task={editing} kind={editing?.kind??creating!} busy={busy||stale} error={error} save={data=>run(()=>api(editing?`/planner/tasks/${editing.id}/edit`:'/planner/tasks','POST',data),()=>{setCreating(null);setEditing(null);})}/>{editing && !editing.archived && <div className="dialog-task-actions"><button className="subtle" disabled={busy || stale || (editing.kind !== 'DAILY' && editing.completed)} onClick={() => { setRequesting(editing); setEditing(null); }}>Ask for tokens</button><button className="text-button" disabled={busy || stale} onClick={() => void run(() => api(`/planner/tasks/${editing.id}/archive`, 'POST', { archived: true }), () => setEditing(null))}>Archive</button></div>}</PlannerDialog>}
    {requesting && <PlannerDialog title="A little motivation, together." close={()=>{if(!busy)setRequesting(null);}}><TokenRequest task={requesting} spaces={spaces.filter(space=>space.connected)} busy={busy||stale} error={error} save={(space,tokens)=>run(()=>api(`/planner/tasks/${requesting.id}/request-tokens`,'POST',{scopeKind:space.scopeKind,scopeId:space.scopeId,tokens}),()=>setRequesting(null))} connect={()=>{setRequesting(null);navigate('together');}}/></PlannerDialog>}
  </div>;
}

function PlannerDialog({title,close,children}:{title:string;close:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();dialog?.querySelector<HTMLElement>('input, textarea, select')?.focus();return()=>dialog?.close();},[]);
  return <dialog ref={ref} className="dialog" aria-label={title} onCancel={e=>{e.preventDefault();close();}}><div className="row between"><h2>{title}</h2><button className="subtle" aria-label="Close dialog" onClick={close}>×</button></div>{children}</dialog>;
}
function TaskForm({task,kind,busy,error,save,spaces=[],initialSpace,sharingAvailable=true}:{task:PersonalTask|null;kind:PersonalTask['kind'];busy:boolean;error:string;save:(data:object)=>Promise<void>;spaces?:PlannerSpace[];initialSpace?:PlannerSpace;sharingAvailable?:boolean}) {
  const [title,setTitle]=useState(task?.title??''),[notes,setNotes]=useState(task?.notes??''),[dueOn,setDueOn]=useState(task?.dueOn??''),[target,setTarget]=useState(task?.target??10),[weekdays,setWeekdays]=useState(task?.weekdays??[1,2,3,4,5,6,7]);
  const [sharedWith,setSharedWith]=useState((task?.shares ?? (initialSpace ? [initialSpace] : [])).filter(share=>spaces.some(space=>spaceKey(space)===spaceKey(share))));
  function submit(e:FormEvent){e.preventDefault();void save({title,notes,dueOn:dueOn||null,target:kind==='GOAL'?target:1,weekdays,...(sharingAvailable ? {spaces:sharedWith.map(space=>({scopeKind:space.scopeKind,scopeId:space.scopeId}))} : {}),...(!task?{kind,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}: {})});}
  return <form onSubmit={submit}><fieldset disabled={busy}>{error&&<p className="notice error" role="alert">{error}</p>}<label className="field">{kindName[kind]} title<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} autoFocus placeholder={kind==='DAILY'?'Read for 20 minutes':kind==='GOAL'?'Finish 12 books':'What’s on your mind?'}/></label><label className="field">Notes · only you can see these<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>{kind!=='DAILY'&&<label className="field">Due date · optional<input type="date" value={dueOn} onChange={e=>setDueOn(e.target.value)}/></label>}{kind==='GOAL'&&<label className="field">Steps to your goal<input type="number" min={Math.max(task?.progress??0,1)} max={10000} required disabled={!!task?.completed} value={target} onChange={e=>setTarget(Number(e.target.value))}/></label>}{kind==='DAILY'&&<fieldset className="day-picker"><legend>Repeat on these days</legend>{days.map((day,index)=><label key={day}><span>{day}</span><input type="checkbox" checked={weekdays.includes(index+1)} onChange={e=>setWeekdays(e.target.checked?[...weekdays,index+1].sort((a,b)=>a-b):weekdays.filter(d=>d!==index+1))}/></label>)}</fieldset>}<fieldset className="task-sharing" disabled={!sharingAvailable}><legend>Show this task in</legend><p className="small muted">Always in Personal. Share the task and its progress below; your notes stay private.</p>{spaces.map(space=><label key={spaceKey(space)}><input type="checkbox" checked={sharedWith.some(item=>spaceKey(item)===spaceKey(space))} onChange={event=>setSharedWith(event.target.checked?[...sharedWith,space]:sharedWith.filter(item=>spaceKey(item)!==spaceKey(space)))}/><span>{spaceLabel(space)}</span></label>)}{!spaces.length&&<p className="small muted">Connect a partner or create a group in Together to share tasks.</p>}{!sharingAvailable&&<p role="status" className="small muted">Sharing could not load. Your existing sharing choices will be kept.</p>}<p className="small muted">Token requests stay visible in their markets.</p></fieldset>{task?.proposals.length ? <p className="small muted">Changing the title, target, schedule, or due date sends token terms back for approval. Notes stay private.</p>:null}<button className="primary wide" disabled={!weekdays.length}>{busy?'Saving…':task?'Save changes':'Add to my planner'}</button></fieldset></form>;
}
function TokenRequest({task,spaces,busy,error,save,connect}:{task:PersonalTask;spaces:PlannerSpace[];busy:boolean;error:string;save:(space:PlannerSpace,tokens:number)=>Promise<void>;connect:()=>void}) {
 const [selected,setSelected]=useState(spaces[0]?spaceKey(spaces[0]):''),[tokens,setTokens]=useState(5);
 const space=spaces.find(s=>spaceKey(s)===selected);
 const existing=task.proposals.find(p=>p.scopeKind===space?.scopeKind&&p.scopeId===space?.scopeId&&p.status!=='REJECTED');
 return !space?<div className="empty"><p className="muted">Connect with a partner or another group member to request tokens. Your task still works on its own.</p><button className="primary" onClick={connect}>Connect your people →</button></div>:<form onSubmit={e=>{e.preventDefault();void save(space,tokens);}}><fieldset disabled={busy}>{error&&<p className="notice error" role="alert">{error}</p>}<h3>{task.title}</h3><label className="field">Send to<select value={selected} onChange={e=>setSelected(e.target.value)}>{spaces.map(s=><option key={spaceKey(s)} value={spaceKey(s)}>{spaceLabel(s)}</option>)}</select></label><label className="field">Tokens {task.kind==='DAILY'?'per completed day':'when complete'}<input type="number" required min={1} max={10000} value={tokens} onChange={e=>setTokens(Number(e.target.value))}/></label><p className="muted small">One other member must approve before you finish. {task.kind==='DAILY'?'Only future daily check-ins earn tokens.':'Earlier completions do not earn tokens retroactively.'} Your title, schedule, due date, and progress are shared with this space; your notes stay private.</p>{existing&&<p className="notice">This space already has an {existing.status==='ACTIVE'?'approved':'awaiting-approval'} request for this task.</p>}<button className="primary wide" disabled={!!existing}>Send token request →</button></fieldset></form>;
}
function PartnerSpace({run}:{run:(action:()=>Promise<unknown>,after?:()=>void)=>Promise<void>}) {
 const [name,setName]=useState('Our little rituals');
 return <form className="card partner-space-form" onSubmit={e=>{e.preventDefault();void run(()=>api('/pairs','POST',{name,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}));}}><h2>Make a space for your person</h2><p className="muted small">Create it now, then share a PAIR code. The partner token market opens once they join.</p><label className="field">Partner space name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary">Create partner space →</button></form>;
}
function Market({account,space,data,run}:{account:Account;space:PlannerSpace;data:MarketData;run:(action:()=>Promise<unknown>,after?:()=>void)=>Promise<void>}) {
 const [offering,setOffering]=useState(false),[title,setTitle]=useState(''),[expectation,setExpectation]=useState(''),[cost,setCost]=useState(10);
 const name=(id:string)=>id===account.id?'You':data.members.find(m=>m.userId===id)?.user.email.split('@')[0]??'A member';
 const pending=data.proposals.filter(p=>p.status==='PENDING' && p.task.userId !== account.id);
 async function redeem(id:string){const storageKey=`brewtual-market:${account.id}:${id}`;let key=sessionStorage.getItem(storageKey);if(!key){key=crypto.randomUUID();sessionStorage.setItem(storageKey,key);}await api(`/planner/rewards/${id}/redeem`,'POST',{},key);sessionStorage.removeItem(storageKey);}
 return <><div className="section-heading"><div><h2>Token requests</h2><p className="muted small">Approve the work and amount before it’s completed.</p></div><span className="status">{pending.length} awaiting review</span></div>{data.proposals.map(p=><article className="card row between" key={p.id}><div><p className="eyebrow">{name(p.task.userId)} · {kindName[p.task.kind]}</p><h3>{p.task.title}</h3><p className="small muted">{p.tokens} tokens {p.task.kind==='DAILY'?'per scheduled day':'on completion'} · {p.status==='ACTIVE'?'Approved':p.status==='REJECTED'?'Declined':'Awaiting approval'}</p>{p.task.kind==='GOAL'&&<p className="small muted">{p.task.progress} / {p.task.target} steps</p>}{p.task.kind==='DAILY'&&<p className="small muted">{p.task.weekdays.map(d=>days[d-1]).join(' · ')}</p>}{p.task.dueOn&&<p className="small muted">Due {p.task.dueOn}</p>}</div>{p.status==='PENDING'&&p.task.userId!==account.id&&<div className="row"><button className="primary" onClick={()=>void run(()=>api(`/planner/requests/${p.id}/decide`,'POST',{approve:true}))}>Approve {p.tokens} ✧</button><button className="subtle" onClick={()=>void run(()=>api(`/planner/requests/${p.id}/decide`,'POST',{approve:false}))}>Decline</button></div>}</article>)}{!data.proposals.length&&<p className="muted small">Use “Ask for tokens” on a personal task, Daily, or Goal to send the first request.</p>}
 <div className="section-heading"><div><h2>Something to look forward to</h2><p className="muted small">Offer a reward for someone else to enjoy. Another member approves it.</p></div><button className="primary" onClick={()=>setOffering(!offering)}>{offering?'Close offer form':'＋ Offer a reward'}</button></div>{offering&&<form className="card" onSubmit={e=>{e.preventDefault();void run(()=>api('/planner/rewards','POST',{scopeKind:space.scopeKind,scopeId:space.scopeId,title,expectation,cost}),()=>{setOffering(false);setTitle('');setExpectation('');});}}><label className="field">Reward title<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Coffee’s on me"/></label><label className="field">What will you do?<textarea required maxLength={1000} value={expectation} onChange={e=>setExpectation(e.target.value)}/></label><label className="field">Token cost<input required type="number" min={1} max={1000000} value={cost} onChange={e=>setCost(Number(e.target.value))}/></label><button className="primary">Share reward for approval →</button></form>}
 <div className="planner-goal-grid">{data.rewards.map(reward=><article className="card market-reward" key={reward.id}><div className="market-reward-art"><AppIcon name="market"/></div><p className="eyebrow">{name(reward.offeredById)} OFFERED · {reward.cost} TOKENS</p><h3>{reward.title}</h3><p className="muted small">{reward.expectation}</p>{reward.status==='PENDING'&&reward.offeredById!==account.id?<div className="row"><button className="primary" onClick={()=>void run(()=>api(`/planner/rewards/${reward.id}/decide`,'POST',{approve:true}))}>Approve offer</button><button className="subtle" onClick={()=>void run(()=>api(`/planner/rewards/${reward.id}/decide`,'POST',{approve:false}))}>Decline</button></div>:reward.status==='ACTIVE'&&reward.offeredById!==account.id?<button className="primary wide" disabled={data.balance<reward.cost} onClick={()=>{if(window.confirm(`Spend ${reward.cost} ${spaceLabel(space)} tokens on “${reward.title}”?`))void run(()=>redeem(reward.id));}}>{data.balance<reward.cost?`Need ${reward.cost-data.balance} more tokens`:`Redeem for ${reward.cost} ✧`}</button>:<span className="status">{reward.status==='ACTIVE'?'Your offer · for your people':reward.status==='PENDING'?'Waiting for approval':'Declined'}</span>}</article>)}</div>{!data.rewards.length&&<section className="empty"><h3>A thoughtful little treat goes a long way.</h3><p className="muted">Offer the first reward in {space.name}.</p></section>}
 <div className="section-heading"><h2>Plans to fulfill</h2></div>{data.redemptions.map(item=><article className="card row between" key={item.id}><div><h3>{item.reward.title}</h3><p className="muted small">{name(item.spenderId)} redeemed · {item.cost} tokens · {item.status==='FULFILLED'?'Fulfilled':'Awaiting fulfillment'}</p><p className="small">{item.reward.expectation}</p></div>{item.status==='REQUESTED'&&item.reward.offeredById===account.id&&<button className="primary" onClick={()=>void run(()=>api(`/planner/redemptions/${item.id}/fulfill`,'POST'))}>Mark fulfilled</button>}</article>)}{!data.redemptions.length&&<p className="muted small">Redeemed rewards will appear here for the offerer to fulfill.</p>}
 </>;
}
