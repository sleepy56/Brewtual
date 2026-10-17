'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Account,
  ApiError,
  api,
  confirm,
  refreshSession,
  resend,
  signIn,
  signOut,
  signup,
} from './client';
import type { Goal, Ledger, Pair, Redemption, Reward } from './types';
import { addLocalDays, localDate, localWeekday, weekStart } from '../server/domain/calendar';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const themes = ['midnight', 'dawn', 'plum', 'ocean'];
type Tab = 'today' | 'goals' | 'rewards' | 'activity' | 'settings';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const initials = (email: string) => email.slice(0, 2).toUpperCase();

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Notice({ children, kind = 'error' }: { children: ReactNode; kind?: 'error' | 'success' }) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export default function PairHabits({ verify = false }: { verify?: boolean }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(verify);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('midnight');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('@pair-habits/theme');
      if (saved && themes.includes(saved)) setTheme(saved);
    } catch {
      /* Preferences stay usable without storage. */
    }
    if (verify) return;
    let active = true;
    refreshSession()
      .then((user) => {
        if (active) setAccount(user);
      })
      .catch((reason) => {
        if (active && (!(reason instanceof ApiError) || reason.status !== 401))
          setError(message(reason));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [verify]);
  function changeTheme(next: string) {
    setTheme(next);
    try {
      localStorage.setItem('@pair-habits/theme', next);
    } catch {
      setError('This browser cannot save your theme preference.');
    }
  }
  async function logout() {
    try {
      await signOut();
    } catch (reason) {
      setError(`Sign-out could not reach the server. ${message(reason)}`);
    } finally {
      setAccount(null);
    }
  }
  return (
    <div className="app" data-theme={theme}>
      {!ready ? (
        <main className="center-page">
          <p role="status">Opening your shared space…</p>
        </main>
      ) : account ? (
        <Workspace
          key={account.id}
          account={account}
          logout={logout}
          theme={theme}
          setTheme={changeTheme}
        />
      ) : (
        <Auth
          verify={verify}
          onLogin={(user) => {
            setAccount(user);
            setError('');
          }}
          startupError={error}
        />
      )}
    </div>
  );
}

function Auth({
  verify,
  onLogin,
  startupError,
}: {
  verify: boolean;
  onLogin: (account: Account) => void;
  startupError: string;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify'>(verify ? 'verify' : 'login');
  const [verificationRequired, setVerificationRequired] = useState(verify);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    if (!verify) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    setEmail(params.get('email') ?? '');
    setToken(params.get('token') ?? '');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [verify]);
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (reason) {
      setError(message(reason));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (mode === 'login') onLogin(await signIn(email, password));
      else if (mode === 'signup') {
        const result = await signup(email, password);
        setVerificationRequired(result.verificationRequired);
        setPassword('');
        setMode('login');
        setNotice(result.message);
      } else {
        await confirm(email, token, password);
        setToken('');
        setPassword('');
        setMode('login');
        setNotice('Email verified. You can now sign in.');
      }
    });
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a href="/" className="brand">
          ❧ <span>pair habits.</span>
        </a>
        <div>
          <p className="eyebrow">LITTLE ROUTINES. SHARED JOY.</p>
          <h1>
            Good things
            <br />
            grow together.
          </h1>
          <p>
            A little encouragement. A reason to show up.
            <br />A shared space for the life you’re building.
          </p>
          <div className="story-art" aria-hidden="true">
            ❧<span>one small step, together.</span>
          </div>
        </div>
        <p className="muted small">Your routines, your pace, your person.</p>
      </section>
      <section className="auth-side">
        <div className="auth-card">
          <p className="eyebrow">YOUR SHARED SPACE</p>
          <h2>
            {mode === 'verify'
              ? 'One last little step.'
              : mode === 'signup'
                ? 'Start growing together.'
                : 'Welcome back.'}
          </h2>
          <p className="muted">
            {mode === 'verify'
              ? 'Confirm your email with the password you chose when registering.'
              : mode === 'signup'
                ? 'Create your account with an email address and password.'
                : 'Pick up where you left off.'}
          </p>
          {(error || startupError) && <Notice>{error || startupError}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}
          {mode !== 'verify' && (
            <div className="segmented" aria-label="Account action">
              <button
                className={mode === 'login' ? 'selected' : ''}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Sign in
              </button>
              <button
                className={mode === 'signup' ? 'selected' : ''}
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
              >
                Create account
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <Field label="Email address">
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label={mode === 'verify' ? 'Registration password' : 'Password'}>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'login' ? 1 : 15}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'At least 15 characters' : 'Your password'}
                />
              </Field>
              {mode === 'verify' && !token && (
                <p className="muted small">
                  Open the verification link from your email to load its token. If you reloaded this
                  page, open that link again.
                </p>
              )}
              <button className="primary wide" disabled={mode === 'verify' && !token}>
                {busy
                  ? 'Please wait…'
                  : mode === 'verify'
                    ? 'Verify my email'
                    : mode === 'signup'
                      ? 'Create my account'
                      : 'Open my shared space'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
            </fieldset>
          </form>
          {verificationRequired && (
            <button
              className="text-button"
              disabled={busy || !email}
              onClick={() =>
                void run(async () => {
                  const result = await resend(email);
                  setVerificationRequired(result.verificationRequired);
                  setNotice(result.message);
                })
              }
            >
              Resend verification email
            </button>
          )}
          {mode === 'verify' && (
            <button
              className="text-button"
              onClick={() => {
                setMode('login');
                setPassword('');
              }}
            >
              Back to sign in
            </button>
          )}
          <p className="small muted auth-note">
            Your partner joins with their own account.
            <br />
            You’ll connect your shared space after signing in.
          </p>
        </div>
      </section>
    </main>
  );
}

function Workspace({
  account,
  logout,
  theme,
  setTheme,
}: {
  account: Account;
  logout: () => Promise<void>;
  theme: string;
  setTheme: (value: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('today');
  const [pair, setPair] = useState<Pair | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [requests, setRequests] = useState<Redemption[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [creating, setCreating] = useState<'goal' | 'reward' | null>(null);
  const [reviewReward, setReviewReward] = useState<Reward | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      let current: Pair;
      try {
        current = await api<Pair>('/pairs/current');
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 403) {
          if (mounted.current) {
            setPair(null);
            setLoaded(true);
            setStale(false);
            setError('');
          }
          return;
        }
        throw reason;
      }
      let more = true;
      // Finish bounded settlement batches before displaying a spendable balance.
      while (more) more = (await api<{ hasMore: boolean }>('/wallet/settle', 'POST')).hasMore;
      const [nextGoals, nextRewards, nextRequests, nextLedger, wallet] = await Promise.all([
        api<Goal[]>('/goals'),
        api<Reward[]>('/rewards'),
        api<Redemption[]>('/rewards/redemptions'),
        api<Ledger[]>('/wallet/ledger'),
        api<{ balance: number }>('/wallet'),
      ]);
      if (!mounted.current) return;
      setPair(current);
      setGoals(nextGoals);
      setRewards(nextRewards);
      setRequests(nextRequests);
      setLedger(nextLedger);
      setBalance(wallet.balance);
      setLoaded(true);
      setStale(false);
      setError('');
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && reason.status === 401) {
        await logout();
        return;
      }
      setStale(true);
      setError(message(reason));
      throw reason;
    }
  }, [logout]);
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [account.id]);
  async function mutate(action: () => Promise<unknown>): Promise<boolean> {
    if (pending.current || stale) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      try {
        await refresh();
        setNotice('Saved to your shared space.');
      } catch {
        setError(
          'Your change was saved, but the updated view could not load. Retry loading before making another change.',
        );
      }
      return true;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) await logout();
      else setError(message(reason));
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const name = (id: string) =>
    id === account.id
      ? 'You'
      : (pair?.members.find((member) => member.user.id === id)?.user.email.split('@')[0] ??
        'Your partner');
  const today = pair ? localDate(new Date(), pair.pair.timezone) : '';
  const monday = today ? weekStart(today) : '';
  const ownGoals = goals.filter((goal) => goal.ownerId === account.id && goal.status === 'ACTIVE');
  const todaysGoals = ownGoals.filter(
    (goal) =>
      goal.startsOn && goal.startsOn <= today && goal.weekdays.includes(localWeekday(today)),
  );
  const approvals = [
    ...goals.filter((goal) => goal.status === 'PENDING' && goal.proposedById !== account.id),
    ...rewards.filter((reward) => reward.status === 'PENDING' && reward.offeredById !== account.id),
  ];
  const tabs: { id: Tab; icon: string; title: string }[] = [
    { id: 'today', icon: '⌂', title: 'Today' },
    { id: 'goals', icon: '◎', title: 'Goals' },
    { id: 'rewards', icon: '♧', title: 'Rewards' },
    { id: 'activity', icon: '↗', title: 'Activity' },
    { id: 'settings', icon: '⚙', title: 'Settings' },
  ];
  const action = (path: string, method = 'POST') => void mutate(() => api(path, method));
  async function redeem(reward: Reward) {
    const storageKey = `pair-redeem-${account.id}-${reward.id}`;
    await mutate(async () => {
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      await api(`/rewards/${reward.id}/redeem`, 'POST', undefined, key);
      sessionStorage.removeItem(storageKey);
      setReviewReward(null);
    });
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a href="/" className="brand">
          ❧ <span>pair habits.</span>
        </a>
        <p className="eyebrow">YOUR SHARED ROUTINE</p>
        <nav aria-label="Main navigation">
          {tabs.map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? 'page' : undefined}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
              {item.id === 'goals' && approvals.length > 0 && (
                <span className="badge">{approvals.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="small muted">{pair?.pair.name ?? 'Your shared space'}</p>
          <p className="small">{account.email}</p>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <a href="/" className="brand">
            ❧ <span>pair habits.</span>
          </a>
          <div className="row">
            <span className="token-pill">✧ {balance} tokens</span>
            <button
              className="avatar"
              aria-label="Account settings"
              onClick={() => setTab('settings')}
            >
              {initials(account.email)}
            </button>
          </div>
        </header>
        <main className="content">
          {error && (
            <Notice>
              {error}{' '}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void refresh().catch(() => {})}
              >
                Retry loading
              </button>
            </Notice>
          )}
          {notice && <Notice kind="success">{notice}</Notice>}
          {!loaded ? (
            <div className="empty">
              <h1>Your shared space.</h1>
              <p role="status">
                {error ? 'We could not load your habits.' : 'Loading your habits…'}
              </p>
            </div>
          ) : !pair || pair.members.length < 2 ? (
            <PairSetup
              pair={pair}
              busy={busy || stale}
              run={mutate}
              refresh={() => refresh().catch(() => {})}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{pair.pair.name.toUpperCase()}</p>
                  <h1>
                    {tab === 'today'
                      ? 'A little progress, together.'
                      : tab === 'goals'
                        ? 'Small steps. Lasting habits.'
                        : tab === 'rewards'
                          ? 'Little rewards. Lovely moments.'
                          : tab === 'activity'
                            ? 'Look how far you’ve come.'
                            : 'Make yourself at home.'}
                  </h1>
                </div>
                <button
                  className="subtle"
                  disabled={busy}
                  onClick={() => void refresh().catch(() => {})}
                >
                  ↻ Refresh
                </button>
              </div>
              <fieldset disabled={busy || stale} className="workspace-actions" aria-busy={busy}>
                {tab === 'today' && (
                  <>
                    <section className="hero">
                      <div>
                        <p className="eyebrow">ONE DAY AT A TIME</p>
                        <h2>Show up for the little things.</h2>
                        <p>
                          {
                            todaysGoals.filter((goal) =>
                              goal.checkIns.some((check) => check.localDate === today),
                            ).length
                          }{' '}
                          of {todaysGoals.length} habits complete today.
                        </p>
                      </div>
                      <span aria-hidden="true">❧</span>
                    </section>
                    <div className="section-heading">
                      <h2>Today’s little rituals</h2>
                      <span className="small muted">
                        {today} · {pair.pair.timezone}
                      </span>
                    </div>
                    {!todaysGoals.length && (
                      <Empty
                        title="A little room to breathe."
                        text="No habits scheduled for today. Explore your goals or propose something new."
                      />
                    )}
                    {todaysGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        userId={account.id}
                        today={today}
                        monday={monday}
                        name={name}
                        action={action}
                      />
                    ))}
                    {approvals.length > 0 && (
                      <button className="approval-callout" onClick={() => setTab('goals')}>
                        {approvals.length} proposals are waiting for your encouragement. Review them
                        →
                      </button>
                    )}
                  </>
                )}
                {tab === 'goals' && (
                  <>
                    <div className="section-heading">
                      <h2>Your shared intentions</h2>
                      <button className="primary" onClick={() => setCreating('goal')}>
                        ＋ Propose a habit
                      </button>
                    </div>
                    {goals.length ? (
                      goals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          userId={account.id}
                          today={today}
                          monday={monday}
                          name={name}
                          action={action}
                        />
                      ))
                    ) : (
                      <Empty
                        title="Every routine starts somewhere."
                        text="Propose a habit. Your partner approves it, and your first week starts the following Monday."
                      />
                    )}
                    {rewards
                      .filter(
                        (reward) =>
                          reward.status === 'PENDING' && reward.offeredById !== account.id,
                      )
                      .map((reward) => (
                        <article className="card" key={reward.id}>
                          <span className="eyebrow">REWARD APPROVAL</span>
                          <h3>{reward.title}</h3>
                          <p>
                            {reward.fulfillmentExpectation} · {reward.cost} tokens
                          </p>
                          <div className="row">
                            <button
                              className="primary"
                              onClick={() => action(`/rewards/${reward.id}/approve`)}
                            >
                              Approve reward
                            </button>
                            <button
                              className="subtle"
                              onClick={() => action(`/rewards/${reward.id}/reject`)}
                            >
                              Decline
                            </button>
                          </div>
                        </article>
                      ))}
                  </>
                )}
                {tab === 'rewards' && (
                  <>
                    <div className="section-heading">
                      <h2>Made for each other</h2>
                      <button className="primary" onClick={() => setCreating('reward')}>
                        ＋ Offer a reward
                      </button>
                    </div>
                    <div className="reward-grid">
                      {rewards.map((reward) => (
                        <article className="card reward-card" key={reward.id}>
                          <div className="reward-art" aria-hidden="true">
                            ♧
                          </div>
                          <span className="accent small">✧ {reward.cost} tokens</span>
                          <h3>{reward.title}</h3>
                          <p className="muted">{reward.description}</p>
                          <p className="small">{reward.fulfillmentExpectation}</p>
                          <p className="small muted">Offered by {name(reward.offeredById)}</p>
                          {reward.status === 'PENDING' && reward.offeredById !== account.id ? (
                            <div className="row">
                              <button
                                className="primary"
                                onClick={() => action(`/rewards/${reward.id}/approve`)}
                              >
                                Approve
                              </button>
                              <button
                                className="subtle"
                                onClick={() => action(`/rewards/${reward.id}/reject`)}
                              >
                                Decline
                              </button>
                            </div>
                          ) : reward.status !== 'ACTIVE' ? (
                            <span className="status">
                              {reward.status === 'PENDING' ? 'Waiting for approval' : 'Declined'}
                            </span>
                          ) : reward.offeredById === account.id ? (
                            <span className="small muted">Your offer · for your partner</span>
                          ) : (
                            <button
                              className="primary wide"
                              disabled={balance < reward.cost}
                              onClick={() => setReviewReward(reward)}
                            >
                              {balance < reward.cost
                                ? `Need ${reward.cost - balance} more tokens`
                                : 'Make a little plan'}
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                    {!rewards.length && (
                      <Empty
                        title="Something to look forward to."
                        text="Offer a thoughtful reward and agree together on what it means."
                      />
                    )}
                  </>
                )}
                {tab === 'activity' && (
                  <>
                    <section className="hero">
                      <div>
                        <p className="eyebrow">YOUR LITTLE WINS</p>
                        <h2>{balance} tokens to enjoy.</h2>
                        <p>Completed weekly goals earn tokens after the week closes.</p>
                      </div>
                      <span aria-hidden="true">✧</span>
                    </section>
                    <h2>Plans together</h2>
                    {requests.map((item) => (
                      <article className="card row between" key={item.id}>
                        <div>
                          <h3>{item.reward.title}</h3>
                          <p className="small muted">
                            {name(item.spenderId)} · {item.cost} tokens ·{' '}
                            {item.status === 'FULFILLED' ? 'Fulfilled' : 'Awaiting fulfillment'}
                          </p>
                          <p>{item.reward.fulfillmentExpectation}</p>
                        </div>
                        {item.status === 'REQUESTED' && item.reward.offeredById === account.id && (
                          <button
                            className="primary"
                            onClick={() => action(`/rewards/redemptions/${item.id}/fulfill`)}
                          >
                            Mark fulfilled
                          </button>
                        )}
                      </article>
                    ))}
                    {!requests.length && (
                      <p className="muted">Your shared reward plans will appear here.</p>
                    )}
                    <h2>Token history</h2>
                    {ledger.map((item) => (
                      <article className="ledger-row" key={item.id}>
                        <div>
                          <strong>
                            {item.reason === 'WEEKLY_AWARD'
                              ? 'Weekly habit award'
                              : 'Reward redemption'}
                          </strong>
                          <p className="small muted">
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              timeZone: pair.pair.timezone,
                            })}
                          </p>
                        </div>
                        <strong className={item.amount > 0 ? 'accent' : ''}>
                          {item.amount > 0 ? '+' : ''}
                          {item.amount} ✧
                        </strong>
                      </article>
                    ))}
                    {!ledger.length && (
                      <p className="muted">Your first little win is ahead of you.</p>
                    )}
                  </>
                )}
              </fieldset>
            </>
          )}
          {loaded && tab === 'settings' && (
            <section className="card settings">
              <h2>Your preferences</h2>
              <Field label="Color theme">
                <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                  {themes.map((value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="muted">{account.email}</p>
              {pair && (
                <p>
                  {pair.pair.name} · {pair.pair.timezone}
                </p>
              )}
              <button className="subtle" onClick={() => void logout()}>
                Sign out
              </button>
            </section>
          )}
          {loaded && (!pair || pair.members.length < 2) && (
            <button className="text-button" onClick={() => void logout()}>
              Sign out
            </button>
          )}
        </main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {tabs.map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
            </button>
          ))}
        </nav>
      </div>
      {creating && (
        <Dialog
          title={creating === 'goal' ? 'A new little habit.' : 'Something lovely to offer.'}
          close={() => {
            if (!busy) setCreating(null);
          }}
        >
          {error && <Notice>{error}</Notice>}
          <Proposal
            kind={creating}
            busy={busy || stale}
            save={async (data) => {
              const ok = await mutate(() =>
                api(creating === 'goal' ? '/goals' : '/rewards', 'POST', data),
              );
              if (ok) setCreating(null);
            }}
          />
        </Dialog>
      )}
      {reviewReward && (
        <Dialog
          title="Review your little plan"
          close={() => {
            if (!busy) setReviewReward(null);
          }}
        >
          {error && <Notice>{error}</Notice>}
          <p>
            Spend {reviewReward.cost} tokens on “{reviewReward.title}”?
          </p>
          <p className="muted">{reviewReward.fulfillmentExpectation}</p>
          <p>Your balance will be {balance - reviewReward.cost} tokens.</p>
          <button
            className="primary wide"
            disabled={busy || stale}
            onClick={() => void redeem(reviewReward)}
          >
            {busy ? 'Saving…' : `Spend ${reviewReward.cost} tokens`}
          </button>
        </Dialog>
      )}
    </div>
  );
}

function PairSetup({
  pair,
  busy,
  run,
  refresh,
}: {
  pair: Pair | null;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState('Our pair');
  const [timezone, setTimezone] = useState('UTC');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [invite, setInvite] = useState('');
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);
  return (
    <section className="onboarding">
      <p className="eyebrow">BETTER TOGETHER</p>
      <h1>{pair ? 'Invite your person.' : 'A space for the two of you.'}</h1>
      <p className="muted">
        {pair
          ? 'Your partner signs up with this email, then accepts the invite token below.'
          : 'Create a shared space or join the one your partner made.'}
      </p>
      <fieldset disabled={busy}>
        {pair ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await api<{ token: string }>('/pairs/invites', 'POST', { email });
                setInvite(result.token);
              });
            }}
          >
            <Field label="Partner’s email">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <button className="primary">Create invite</button>
            {invite && (
              <Field label="Share this one-time invite token with your partner">
                <textarea readOnly value={invite} onFocus={(event) => event.target.select()} />
              </Field>
            )}
          </form>
        ) : (
          <div className="setup-grid">
            <form
              className="card"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => api('/pairs', 'POST', { name, timezone }));
              }}
            >
              <h2>Create a space</h2>
              <Field label="Pair name">
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Shared timezone">
                <input
                  required
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Asia/Calcutta"
                />
              </Field>
              <p className="small muted">Your habit days and weekly awards use this timezone.</p>
              <button className="primary">Create our space</button>
            </form>
            <form
              className="card"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => api('/pairs/invites/accept', 'POST', { token: token.trim() }));
              }}
            >
              <h2>Join your partner</h2>
              <Field label="Invite token">
                <textarea
                  required
                  minLength={32}
                  maxLength={256}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
              </Field>
              <button className="primary">Join shared space</button>
            </form>
          </div>
        )}
      </fieldset>
      {pair && (
        <button className="subtle" onClick={() => void refresh()}>
          Check if my partner joined
        </button>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  userId,
  today,
  monday,
  name,
  action,
}: {
  goal: Goal;
  userId: string;
  today: string;
  monday: string;
  name: (id: string) => string;
  action: (path: string, method?: string) => void;
}) {
  const checked = goal.checkIns.some((check) => check.localDate === today);
  const completed = goal.checkIns.filter(
    (check) => check.localDate >= monday && check.localDate <= addLocalDays(monday, 6),
  ).length;
  const eligible =
    goal.ownerId === userId &&
    goal.status === 'ACTIVE' &&
    !!goal.startsOn &&
    goal.startsOn <= today &&
    goal.weekdays.includes(localWeekday(today));
  return (
    <article className="card goal-card">
      <div className="row between">
        <div>
          <p className="small muted">
            {name(goal.ownerId)} · {goal.weekdays.map((day) => days[day - 1]).join(', ')}
          </p>
          <h3>{goal.title}</h3>
          {goal.description && <p className="muted">{goal.description}</p>}
        </div>
        <span className="token-pill">✧ {goal.weeklyTokens}/week</span>
      </div>
      <div
        className="week-dots"
        aria-label={`${completed} of ${goal.requiredCount} completed this week`}
      >
        {days.map((day, index) => {
          const date = addLocalDays(monday, index);
          return (
            <span
              key={day}
              className={`${goal.checkIns.some((check) => check.localDate === date) ? 'done' : ''} ${goal.weekdays.includes(index + 1) ? 'scheduled' : ''}`}
              title={`${day} ${date}`}
            >
              <span>{day}</span>
              <b aria-hidden="true">
                {goal.checkIns.some((check) => check.localDate === date) ? '✓' : '·'}
              </b>
            </span>
          );
        })}
      </div>
      <div className="row between">
        <p className="small muted">
          {goal.status === 'PENDING'
            ? 'Waiting for partner approval'
            : goal.status === 'REJECTED'
              ? 'Declined'
              : goal.startsOn && goal.startsOn > today
                ? `Starts ${goal.startsOn}`
                : `${completed}/${goal.requiredCount} this week`}
        </p>
        {goal.status === 'PENDING' && goal.proposedById !== userId ? (
          <div className="row">
            <button className="primary" onClick={() => action(`/goals/${goal.id}/approve`)}>
              Approve
            </button>
            <button className="subtle" onClick={() => action(`/goals/${goal.id}/reject`)}>
              Decline
            </button>
          </div>
        ) : goal.ownerId === userId && checked ? (
          <button
            className="subtle"
            onClick={() => action(`/goals/${goal.id}/check-ins/today`, 'DELETE')}
          >
            ✓ Done · Undo
          </button>
        ) : eligible ? (
          <button className="primary" onClick={() => action(`/goals/${goal.id}/check-ins`)}>
            Check in
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="card empty">
      <span className="accent" aria-hidden="true">
        ❧
      </span>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
    </section>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="row between">
        <h2>{title}</h2>
        <button className="subtle" aria-label="Close dialog" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Proposal({
  kind,
  busy,
  save,
}: {
  kind: 'goal' | 'reward';
  busy: boolean;
  save: (data: object) => Promise<void>;
}) {
  const [selectedDays, setSelectedDays] = useState([1, 3, 5]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void save(
      kind === 'goal'
        ? {
            title: String(data.get('title')),
            description: String(data.get('description')),
            weekdays: selectedDays,
            requiredCount: Number(data.get('requiredCount')),
            weeklyTokens: Number(data.get('tokens')),
          }
        : {
            title: String(data.get('title')),
            description: String(data.get('description')),
            fulfillmentExpectation: String(data.get('expectation')),
            cost: Number(data.get('tokens')),
          },
    );
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <Field label={kind === 'goal' ? 'Habit name' : 'Reward name'}>
          <input
            name="title"
            required
            maxLength={160}
            placeholder={kind === 'goal' ? 'Take a little walk' : 'Choose our next movie'}
          />
        </Field>
        <Field label="Description (optional)">
          <textarea name="description" maxLength={2000} />
        </Field>
        {kind === 'goal' ? (
          <>
            <fieldset className="day-picker">
              <legend>Scheduled days</legend>
              {days.map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(index + 1)}
                    onChange={(event) =>
                      setSelectedDays((values) =>
                        event.target.checked
                          ? [...values, index + 1].sort()
                          : values.filter((value) => value !== index + 1),
                      )
                    }
                  />
                  {day}
                </label>
              ))}
            </fieldset>
            <Field label="Check-ins needed each week">
              <input
                name="requiredCount"
                type="number"
                required
                min={1}
                max={selectedDays.length || 1}
                defaultValue={2}
              />
            </Field>
          </>
        ) : (
          <Field label="How will you fulfill it?">
            <textarea
              name="expectation"
              required
              maxLength={1000}
              placeholder="Plan a cozy movie night together"
            />
          </Field>
        )}
        <Field label={kind === 'goal' ? 'Tokens for a completed week' : 'Token cost'}>
          <input
            name="tokens"
            type="number"
            min={1}
            max={1000000}
            defaultValue={kind === 'goal' ? 5 : 8}
            required
          />
        </Field>
        <p className="small muted">
          {kind === 'goal'
            ? 'Your partner approves your habit. It starts the following Monday.'
            : 'Your partner approves your offer before spending tokens.'}
        </p>
        <button className="primary wide" disabled={kind === 'goal' && !selectedDays.length}>
          {busy ? 'Saving…' : 'Send for approval'}
        </button>
      </fieldset>
    </form>
  );
}
