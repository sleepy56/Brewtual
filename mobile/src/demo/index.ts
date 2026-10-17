import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PersonId } from '../types';

export type GoalStatus = 'proposed' | 'scheduled' | 'active' | 'rejected' | 'claim-pending' | 'complete';
export type GoalType = 'recurring' | 'milestone';

export type Goal = {
  id: string;
  title: string;
  description: string;
  owner: PersonId;
  proposer: PersonId;
  type: GoalType;
  days: number[];
  required: number;
  tokens: number;
  criteria?: string;
  status: GoalStatus;
  checks: string[];
  startDate: string;
  glyph: 'gym' | 'book' | 'leaf' | 'mountain';
};

export type Reward = {
  id: string;
  title: string;
  description: string;
  cost: number;
  offerer: PersonId;
  expectation: string;
  glyph: 'coffee' | 'film' | 'mountain' | 'leaf';
};

export type LedgerEntry = {
  id: string;
  member: PersonId;
  amount: number;
  title: string;
  detail: string;
  date: string;
  source?: string;
  type: 'award' | 'reward';
};

export type RewardRequest = {
  id: string;
  rewardId: string;
  title: string;
  member: PersonId;
  offerer: PersonId;
  cost: number;
  expectation: string;
  status: 'requested' | 'fulfilled';
  date: string;
};

export type DemoState = {
  version: 1;
  person: PersonId;
  goals: Goal[];
  rewards: Reward[];
  ledger: LedgerEntry[];
  requests: RewardRequest[];
};

type NewGoal = Pick<Goal, 'title' | 'description' | 'owner' | 'type' | 'days' | 'required' | 'tokens' | 'criteria' | 'glyph'>;

type DemoContextValue = {
  person: PersonId;
  goals: Goal[];
  rewards: Reward[];
  ledger: LedgerEntry[];
  requests: RewardRequest[];
  balance: number;
  pendingCount: number;
  partnerName: string;
  ready: boolean;
  persistenceError: boolean;
  actions: {
    checkIn: (goalId: string) => { ok: boolean; message: string };
    undoCheckIn: (goalId: string) => { ok: boolean; message: string };
    proposeGoal: (input: NewGoal) => { ok: boolean; message: string; goalId?: string };
    approveGoal: (goalId: string) => { ok: boolean; message: string };
    rejectGoal: (goalId: string) => { ok: boolean; message: string };
    requestReward: (rewardId: string, expectedPerson?: PersonId) => { ok: boolean; message: string };
    fulfillReward: (requestId: string) => { ok: boolean; message: string };
    switchPerson: (person: PersonId) => void;
    resetDemo: () => void;
  };
};

const STORAGE_KEY = '@pair-habits/mobile-demo-v1';
const DEMO_DATE = '2026-10-14';
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const other = (person: PersonId): PersonId => person === 'alex' ? 'jamie' : 'alex';

function seed(): DemoState {
  return {
    version: 1,
    person: 'alex',
    goals: [
      { id: 'gym', title: 'Gym', description: 'Move a little, feel a little stronger.', owner: 'alex', proposer: 'alex', type: 'recurring', days: [0, 2, 4], required: 3, tokens: 3, status: 'active', checks: ['2026-10-12'], startDate: '2026-10-05', glyph: 'gym' },
      { id: 'read', title: 'Read 20 pages', description: 'A little space for a good story.', owner: 'alex', proposer: 'alex', type: 'recurring', days: [0, 1, 2, 3, 4], required: 4, tokens: 2, status: 'active', checks: ['2026-10-12', '2026-10-13'], startDate: '2026-10-05', glyph: 'book' },
      { id: 'walk', title: 'Evening walk', description: 'A 20-minute walk outdoors.', owner: 'jamie', proposer: 'jamie', type: 'recurring', days: [0, 2, 4, 6], required: 3, tokens: 2, status: 'active', checks: ['2026-10-12', '2026-10-14'], startDate: '2026-10-05', glyph: 'leaf' },
      { id: 'stretch', title: 'Morning stretch', description: 'Ten quiet minutes before work.', owner: 'alex', proposer: 'jamie', type: 'recurring', days: [0, 2, 4], required: 2, tokens: 2, status: 'proposed', checks: [], startDate: '2026-10-19', glyph: 'leaf' },
    ],
    rewards: [
      { id: 'coffee', title: 'Coffee, on me', description: 'Your favourite coffee and a slow catch-up.', cost: 8, offerer: 'jamie', expectation: 'Jamie will plan a café visit within 7 days.', glyph: 'coffee' },
      { id: 'movie', title: 'You pick movie night', description: 'Choose the film. Snacks are included.', cost: 16, offerer: 'jamie', expectation: 'Pick a weekend evening together; Jamie handles the snacks.', glyph: 'film' },
      { id: 'day-out', title: 'A little adventure', description: 'An afternoon somewhere new.', cost: 28, offerer: 'jamie', expectation: 'Agree on a nearby outing and a date within 2 weeks.', glyph: 'mountain' },
      { id: 'hobby', title: 'Hobby helper', description: 'An hour of help with your creative project.', cost: 12, offerer: 'alex', expectation: 'Alex offers one hour on a mutually agreed weekend.', glyph: 'leaf' },
    ],
    ledger: [
      { id: 'earn-11-read', member: 'alex', amount: 2, title: 'Read 20 pages', detail: '5–11 Oct · 4 of 4 required · weekly award', date: '12 Oct 2026', source: 'read', type: 'award' },
      { id: 'earn-11-gym', member: 'alex', amount: 3, title: 'Gym', detail: '5–11 Oct · 3 of 3 required · weekly award', date: '12 Oct 2026', source: 'gym', type: 'award' },
      { id: 'opening-alex', member: 'alex', amount: 19, title: 'Earlier agreed goal awards', detail: 'Fictional demo opening history · available tokens', date: '5 Oct 2026', type: 'award' },
      { id: 'spend-hobby', member: 'jamie', amount: -12, title: 'Hobby helper', detail: 'Reward requested from Alex · approved cost snapshot', date: '13 Oct 2026', source: 'hobby', type: 'reward' },
      { id: 'earn-11-walk', member: 'jamie', amount: 2, title: 'Evening walk', detail: '5–11 Oct · 3 of 3 required · weekly award', date: '12 Oct 2026', source: 'walk', type: 'award' },
      { id: 'opening-jamie', member: 'jamie', amount: 28, title: 'Earlier agreed goal awards', detail: 'Fictional demo opening history · available tokens', date: '5 Oct 2026', type: 'award' },
    ],
    requests: [{ id: 'request-hobby', rewardId: 'hobby', title: 'Hobby helper', member: 'jamie', offerer: 'alex', cost: 12, expectation: 'Alex offers one hour on a mutually agreed weekend.', status: 'requested', date: '13 Oct 2026' }],
  };
}

function validState(value: unknown): value is DemoState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<DemoState>;
  const person = (input: unknown): input is PersonId => input === 'alex' || input === 'jamie';
  const nonempty = (input: unknown): input is string => typeof input === 'string' && input.trim().length > 0;
  const finitePositive = (input: unknown) => typeof input === 'number' && Number.isSafeInteger(input) && input > 0;
  const glyphs = ['gym', 'book', 'leaf', 'mountain'];
  const rewardGlyphs = ['coffee', 'film', 'mountain', 'leaf'];
  return s.version === 1 && person(s.person) && Array.isArray(s.goals) && s.goals.every(g => !!g &&
    nonempty(g.id) && nonempty(g.title) && typeof g.description === 'string' && person(g.owner) && person(g.proposer) &&
    (g.type === 'recurring' || g.type === 'milestone') && Array.isArray(g.days) && g.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(g.days).size === g.days.length && Number.isInteger(g.required) && g.required >= 1 && g.required <= 7 &&
    (g.type === 'recurring' ? g.days.length > 0 && g.required <= g.days.length : g.days.length === 0 && g.required === 1 && typeof g.criteria === 'string' && !!g.criteria.trim()) && finitePositive(g.tokens) &&
    ['proposed', 'scheduled', 'active', 'rejected', 'claim-pending', 'complete'].includes(g.status) && Array.isArray(g.checks) && g.checks.every(nonempty) &&
    nonempty(g.startDate) && (g.criteria === undefined || typeof g.criteria === 'string') && glyphs.includes(g.glyph)) &&
    Array.isArray(s.rewards) && s.rewards.every(r => !!r && nonempty(r.id) && nonempty(r.title) && typeof r.description === 'string' &&
      finitePositive(r.cost) && person(r.offerer) && nonempty(r.expectation) && rewardGlyphs.includes(r.glyph)) &&
    Array.isArray(s.ledger) && s.ledger.every(e => !!e && nonempty(e.id) && person(e.member) && typeof e.amount === 'number' && Number.isSafeInteger(e.amount) &&
      nonempty(e.title) && nonempty(e.detail) && nonempty(e.date) && (e.type === 'award' || e.type === 'reward')) &&
    Array.isArray(s.requests) && s.requests.every(r => !!r && nonempty(r.id) && nonempty(r.rewardId) && nonempty(r.title) && person(r.member) && person(r.offerer) &&
      finitePositive(r.cost) && nonempty(r.expectation) && (r.status === 'requested' || r.status === 'fulfilled') && nonempty(r.date)) &&
    ['alex', 'jamie'].every(member => {
      const total = (s.ledger as LedgerEntry[]).filter(entry => entry.member === member).reduce((sum, entry) => sum + entry.amount, 0);
      return Number.isSafeInteger(total) && total >= 0;
    });
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<DemoState>(() => seed());
  const currentState = useRef(state);
  const [ready, setReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState(false);
  const persistQueue = useRef(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!mounted || !raw) return;
      try {
        const stored: unknown = JSON.parse(raw);
        if (validState(stored)) { currentState.current = stored; setState(stored); }
      } catch { /* A damaged local demo safely falls back to its fictional seed. */ }
    }).catch(() => { if (mounted) setPersistenceError(true); }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  const persist = useCallback((next: DemoState) => {
    persistQueue.current = persistQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)))
      .then(() => setPersistenceError(false))
      .catch(() => setPersistenceError(true));
  }, []);

  const mutate = useCallback((fn: (current: DemoState) => DemoState) => {
    const next = fn(currentState.current);
    currentState.current = next;
    setState(next);
    persist(next);
  }, [persist]);

  const balance = state.ledger.filter(entry => entry.member === state.person).reduce((sum, entry) => sum + entry.amount, 0);
  const pendingCount = state.goals.filter(goal => goal.status === 'proposed' && goal.proposer !== state.person).length;

  const actions = useMemo<DemoContextValue['actions']>(() => ({
    checkIn: (goalId) => {
      const current = currentState.current;
      const goal = current.goals.find(item => item.id === goalId);
      if (!goal || goal.status !== 'active' || goal.type !== 'recurring') return { ok: false, message: 'This goal is not ready for a check-in.' };
      if (goal.owner !== current.person) return { ok: false, message: 'Only the goal owner can check in.' };
      if (goal.startDate > DEMO_DATE) return { ok: false, message: 'This agreement starts Monday, 19 October.' };
      const dayIndex = 2; // Wednesday, 14 October 2026 in the local demo calendar.
      if (!goal.days.includes(dayIndex)) return { ok: false, message: `Next check-in: ${DAY_NAMES[goal.days.find(day => day > dayIndex) ?? goal.days[0]]}.` };
      if (goal.checks.includes(DEMO_DATE)) return { ok: false, message: 'Today is already marked complete.' };
      mutate(current => ({ ...current, goals: current.goals.map(item => item.id === goalId ? { ...item, checks: [...item.checks, DEMO_DATE] } : item) }));
      return { ok: true, message: 'Progress updated. Tokens are reviewed after Sunday.' };
    },
    undoCheckIn: (goalId) => {
      const current = currentState.current;
      const goal = current.goals.find(item => item.id === goalId);
      if (!goal || goal.owner !== current.person || !goal.checks.includes(DEMO_DATE)) return { ok: false, message: 'There is no check-in to undo today.' };
      mutate(current => ({ ...current, goals: current.goals.map(item => item.id === goalId ? { ...item, checks: item.checks.filter(date => date !== DEMO_DATE) } : item) }));
      return { ok: true, message: 'Today’s check-in was removed. Your balance is unchanged.' };
    },
    proposeGoal: (input) => {
      const title = input.title.trim();
      if (title.length < 2 || title.length > 80) return { ok: false, message: 'Give the goal a name between 2 and 80 characters.' };
      if (!Number.isInteger(input.tokens) || input.tokens < 1 || input.tokens > 99) return { ok: false, message: 'Choose an award from 1 to 99 tokens.' };
      if (input.type === 'recurring' && (!input.days.length || !Number.isInteger(input.required) || input.required < 1 || input.required > input.days.length)) return { ok: false, message: 'Choose scheduled days and a weekly target that fits them.' };
      if (input.type === 'milestone' && !(input.criteria || '').trim()) return { ok: false, message: 'Describe what “done” means so your partner can review it.' };
      const goalId = id('goal');
      const goal: Goal = { ...input, id: goalId, title, description: input.description.trim(), proposer: currentState.current.person, status: 'proposed', checks: [], startDate: input.type === 'recurring' ? '2026-10-19' : DEMO_DATE };
      mutate(current => ({ ...current, goals: [goal, ...current.goals] }));
      return { ok: true, message: 'Sent to your partner for approval.', goalId };
    },
    approveGoal: (goalId) => {
      const current = currentState.current;
      const goal = current.goals.find(item => item.id === goalId);
      if (!goal || goal.status !== 'proposed') return { ok: false, message: 'This proposal is no longer waiting.' };
      if (goal.proposer === current.person) return { ok: false, message: 'You cannot approve your own proposal.' };
      mutate(current => ({ ...current, goals: current.goals.map(item => item.id === goalId ? { ...item, status: item.type === 'recurring' ? 'scheduled' : 'active', startDate: item.type === 'recurring' ? '2026-10-19' : DEMO_DATE } : item) }));
      return { ok: true, message: goal.type === 'recurring' ? 'Agreed. This goal starts Monday, 19 October.' : 'Agreed. The milestone is ready when its owner is.' };
    },
    rejectGoal: (goalId) => {
      const current = currentState.current;
      const goal = current.goals.find(item => item.id === goalId);
      if (!goal || goal.status !== 'proposed') return { ok: false, message: 'This proposal is no longer waiting.' };
      if (goal.proposer === current.person) return { ok: false, message: 'You cannot review your own proposal.' };
      mutate(current => ({ ...current, goals: current.goals.map(item => item.id === goalId ? { ...item, status: 'rejected' } : item) }));
      return { ok: true, message: 'Proposal declined. Its history stays here.' };
    },
    requestReward: (rewardId, expectedPerson) => {
      const current = currentState.current;
      if (expectedPerson && current.person !== expectedPerson) return { ok: false, message: 'The demo person changed. Review the reward again before spending.' };
      const reward = current.rewards.find(item => item.id === rewardId);
      const currentBalance = current.ledger.filter(entry => entry.member === current.person).reduce((sum, entry) => sum + entry.amount, 0);
      if (!reward) return { ok: false, message: 'This reward is unavailable.' };
      if (reward.offerer === current.person) return { ok: false, message: 'You can request a reward offered by your partner.' };
      if (currentBalance < reward.cost) return { ok: false, message: `You need ${reward.cost - currentBalance} more tokens.` };
      const requestId = id('request');
      mutate(current => ({ ...current,
        ledger: [{ id: `spend-${requestId}`, member: current.person, amount: -reward.cost, title: reward.title, detail: `Reward requested from ${reward.offerer === 'alex' ? 'Alex' : 'Jamie'} · agreed cost`, date: '14 Oct 2026', source: reward.id, type: 'reward' }, ...current.ledger],
        requests: [{ id: requestId, rewardId, title: reward.title, member: current.person, offerer: reward.offerer, cost: reward.cost, expectation: reward.expectation, status: 'requested', date: '14 Oct 2026' }, ...current.requests],
      }));
      return { ok: true, message: `${reward.cost} tokens spent. Your partner can now plan it.` };
    },
    fulfillReward: (requestId) => {
      const current = currentState.current;
      const request = current.requests.find(item => item.id === requestId);
      if (!request || request.status !== 'requested') return { ok: false, message: 'This reward request is no longer open.' };
      if (request.offerer !== current.person) return { ok: false, message: 'Only the person offering this reward can mark it fulfilled.' };
      mutate(current => ({ ...current, requests: current.requests.map(item => item.id === requestId ? { ...item, status: 'fulfilled' } : item) }));
      return { ok: true, message: 'Marked fulfilled. The token record stays in your history.' };
    },
    switchPerson: (person) => mutate(current => ({ ...current, person })),
    resetDemo: () => mutate(() => seed()),
  }), [mutate]);

  const value = useMemo<DemoContextValue>(() => ({
    person: state.person,
    goals: state.goals,
    rewards: state.rewards,
    ledger: state.ledger,
    requests: state.requests,
    balance,
    pendingCount,
    partnerName: other(state.person) === 'alex' ? 'Alex' : 'Jamie',
    ready,
    persistenceError,
    actions,
  }), [state, balance, pendingCount, ready, persistenceError, actions]);

  return React.createElement(DemoContext.Provider, { value }, children);
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used inside DemoProvider');
  return context;
}
