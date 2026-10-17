import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Share, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AppText, Button, Card, Screen } from '../components';
import { AppContext, AppContextValue, Goal, LedgerEntry, NewGoal, Reward, RewardRequest } from '../demo';
import { Account, apiRequest, AuthError } from '../auth/client';
import { useTheme } from '../theme';
import { pairDate } from './calendar';
import { ApiGoal, ApiLedger, ApiPair, ApiRedemption, ApiReward, mapGoal, mapLedger, mapRequest, mapReward, members } from './map';

type LiveData = { pair: ApiPair; person: 'alex' | 'jamie'; names: { alex: string; jamie: string }; today: string; goals: Goal[]; rewards: Reward[]; requests: RewardRequest[]; ledger: LedgerEntry[]; balance: number };
const requestKey = (user: string, reward: string) => `pair-redeem-${user}-${reward}`;
async function savedKey(key: string) {
  if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function saveKey(key: string, value: string | null) {
  if (Platform.OS === 'web') { if (value) globalThis.sessionStorage?.setItem(key, value); else globalThis.sessionStorage?.removeItem(key); }
  else if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}

export function LiveProvider({ account, onSignOut, children }: React.PropsWithChildren<{ account: Account; onSignOut: () => Promise<void> }>) {
  const { theme } = useTheme();
  const [data, setData] = useState<LiveData | null>(null);
  const [phase, setPhase] = useState<'loading' | 'no-pair' | 'pair' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [pairName, setPairName] = useState('Our pair');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [acceptToken, setAcceptToken] = useState('');
  const [pair, setPair] = useState<ApiPair | null>(null);

  const refresh = useCallback(async () => {
    try {
      const current = await apiRequest<ApiPair>('/pairs/current');
      setPair(current);
      if (current.members.length < 2) { setData(null); setPhase('pair'); setError(''); return; }
      await apiRequest('/wallet/settle', 'POST');
      const [apiGoals, apiRewards, apiRequests, apiLedger, wallet] = await Promise.all([
        apiRequest<ApiGoal[]>('/goals'), apiRequest<ApiReward[]>('/rewards'), apiRequest<ApiRedemption[]>('/rewards/redemptions'),
        apiRequest<ApiLedger[]>('/wallet/ledger'), apiRequest<{ balance: number }>('/wallet'),
      ]);
      const { byId, names } = members(current);
      const person = byId(account.id);
      const today = pairDate(new Date(), current.pair.timezone);
      const goals = apiGoals.map(goal => mapGoal(goal, byId, today));
      const rewards = apiRewards.map(reward => mapReward(reward, byId));
      const requests = apiRequests.map(item => mapRequest(item, byId, current.pair.timezone));
      setData({ pair: current, person, names, today, goals, rewards, requests, ledger: apiLedger.map(item => mapLedger(item, requests, person, current.pair.timezone)), balance: wallet.balance });
      setPhase('ready'); setError('');
    } catch (reason) {
      if (reason instanceof AuthError && reason.status === 401) {
        setData(null); setPhase('loading'); await onSignOut(); return;
      }
      if (reason instanceof AuthError && reason.status === 403 && phase === 'loading') { setPhase('no-pair'); setError(''); return; }
      setError(reason instanceof Error ? reason.message : 'Could not load your shared space.');
      if (!data) setPhase('loading');
      throw reason;
    }
  }, [account.id, data, phase, onSignOut]);
  useEffect(() => { void refresh().catch(() => {}); }, [account.id]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); } catch (reason) {
      if (reason instanceof AuthError && reason.status === 401) {
        setData(null); setPhase('loading'); await onSignOut(); return;
      }
      setError(reason instanceof Error ? reason.message : 'The request failed.');
    }
    finally { pending.current = false; setBusy(false); }
  }
  async function mutate(path: string, method = 'POST', body?: object, key?: string) {
    if (pending.current) return { ok: false, message: 'Please wait for the current request.' };
    pending.current = true; setBusy(true);
    try {
      const result = await apiRequest<{ id?: string }>(path, method, body, key);
      await refresh();
      return { ok: true, message: 'Saved and refreshed.', goalId: result?.id };
    } catch (reason) {
      if (reason instanceof AuthError && reason.status === 401) {
        setData(null); setPhase('loading'); await onSignOut();
      }
      return { ok: false, message: reason instanceof Error ? reason.message : 'The request failed. Please retry.' };
    }
    finally { pending.current = false; setBusy(false); }
  }
  const actions = useMemo<AppContextValue['actions']>(() => ({
    checkIn: id => mutate(`/goals/${id}/check-ins`),
    undoCheckIn: id => mutate(`/goals/${id}/check-ins/today`, 'DELETE'),
    proposeGoal: (input: NewGoal) => {
      if (input.type !== 'recurring' || input.owner !== data?.person) return Promise.resolve({ ok: false, message: 'Only your own recurring goal can be proposed here.' });
      if (!input.title.trim() || !input.days.length || !Number.isInteger(input.required) || input.required < 1 || input.required > input.days.length || !Number.isInteger(input.tokens) || input.tokens < 1) return Promise.resolve({ ok: false, message: 'Choose a name, scheduled days, a valid target and token award.' });
      return mutate('/goals', 'POST', { title: input.title.trim(), description: input.description.trim(), weekdays: input.days.map(day => day + 1), requiredCount: input.required, weeklyTokens: input.tokens });
    },
    approveGoal: id => mutate(`/goals/${id}/approve`), rejectGoal: id => mutate(`/goals/${id}/reject`),
    proposeReward: input => {
      if (!input.title.trim() || !input.expectation.trim() || !Number.isInteger(input.cost) || input.cost < 1) return Promise.resolve({ ok: false, message: 'Enter a title, fulfillment plan and valid cost.' });
      return mutate('/rewards', 'POST', { title: input.title.trim(), description: input.description.trim(), fulfillmentExpectation: input.expectation.trim(), cost: input.cost });
    },
    approveReward: id => mutate(`/rewards/${id}/approve`), rejectReward: id => mutate(`/rewards/${id}/reject`),
    requestReward: async (id, expectedPerson) => {
      if (expectedPerson !== data?.person) return { ok: false, message: 'The account changed. Review this reward again.' };
      const storageKey = requestKey(account.id, id);
      let key: string;
      try {
        key = await savedKey(storageKey) ?? `redeem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await saveKey(storageKey, key);
      } catch { return { ok: false, message: 'Could not save a safe retry key. No redemption was sent.' }; }
      const result = await mutate(`/rewards/${id}/redeem`, 'POST', undefined, key);
      if (result.ok) await saveKey(storageKey, null).catch(() => {});
      return result;
    },
    fulfillReward: id => mutate(`/rewards/redemptions/${id}/fulfill`),
    switchPerson: () => {}, resetDemo: () => {},
  }), [data, account.id, refresh]);

  if (phase !== 'ready' || !data) return <Screen>
    <AppText variant="heading" style={{ fontSize: 28, marginBottom: 18 }}>{phase === 'no-pair' ? 'Start your shared space.' : phase === 'pair' ? 'Waiting for your partner.' : 'Opening your shared space.'}</AppText>
    <AppText color={theme.muted} style={{ marginBottom: 18 }}>{account.email}</AppText>
    {error ? <><AppText accessibilityRole="alert" color={theme.danger} style={{ marginBottom: 15 }}>{error}</AppText><Button label="Retry loading" variant="secondary" onPress={() => void refresh().catch(() => {})} /></> : null}
    {phase === 'loading' ? <><ActivityIndicator color={theme.accent} /><Button label="Retry" variant="secondary" onPress={() => void refresh().catch(() => {})} style={{ marginTop: 14 }} /></> : null}
    {phase === 'no-pair' ? <Card style={{ gap: 12 }}>
      <AppText variant="heading">Create a pair</AppText><TextInput accessibilityLabel="Pair name" value={pairName} onChangeText={setPairName} placeholder="Pair name" style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, padding: 12 }} />
      <TextInput accessibilityLabel="Pair timezone" value={timezone} onChangeText={setTimezone} placeholder="IANA timezone" style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, padding: 12 }} />
      <Button label="Create pair" disabled={busy || !pairName.trim() || !timezone.trim()} onPress={() => void run(async () => { await apiRequest('/pairs', 'POST', { name: pairName.trim(), timezone: timezone.trim() }); await refresh(); })} />
      <AppText color={theme.muted}>Have an invitation? Enter its token below using the email it was addressed to.</AppText>
      <TextInput accessibilityLabel="Invitation token" value={acceptToken} onChangeText={setAcceptToken} autoCapitalize="none" style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, padding: 12 }} />
      <Button label="Join pair" disabled={busy || !acceptToken.trim()} variant="secondary" onPress={() => void run(async () => { await apiRequest('/pairs/invites/accept', 'POST', { token: acceptToken.trim() }); setAcceptToken(''); await refresh(); })} />
    </Card> : null}
    {phase === 'pair' ? <Card style={{ gap: 12 }}>
      <AppText variant="heading">{pair?.pair.name}</AppText><AppText color={theme.muted}>Timezone: {pair?.pair.timezone}. Invite your partner at their exact account email. They can sign up before or after you create the invite.</AppText>
      <TextInput accessibilityLabel="Partner email" value={partnerEmail} onChangeText={setPartnerEmail} autoCapitalize="none" keyboardType="email-address" placeholder="partner@example.com" style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, padding: 12 }} />
      <Button label="Create invitation" disabled={busy || !partnerEmail.trim()} onPress={() => void run(async () => { const invite = await apiRequest<{ token: string }>('/pairs/invites', 'POST', { email: partnerEmail.trim().toLowerCase() }); setInviteToken(invite.token); })} />
      {inviteToken ? <><AppText selectable>Share this invitation token privately with {partnerEmail}: {inviteToken}</AppText><Button label="Share invitation" variant="secondary" onPress={() => void Share.share({ message: `Join ${pair?.pair.name} in Pair Habits with your ${partnerEmail} account. Invitation token: ${inviteToken}` })} /></> : null}
      <Button label="Check partner status" disabled={busy} variant="secondary" onPress={() => void run(refresh)} />
    </Card> : null}
    <Button label="Sign out" disabled={busy} variant="ghost" onPress={() => void run(onSignOut)} style={{ marginTop: 20 }} />
  </Screen>;

  const value: AppContextValue = { mode: 'live', today: data.today, timezone: data.pair.pair.timezone, names: data.names, accountEmail: account.email, pairName: data.pair.pair.name,
    person: data.person, goals: data.goals, rewards: data.rewards, requests: data.requests, ledger: data.ledger, balance: data.balance,
    pendingCount: data.goals.filter(goal => goal.status === 'proposed' && goal.proposer !== data.person).length + data.rewards.filter(reward => reward.status === 'proposed' && reward.offerer !== data.person).length,
    partnerName: data.names[data.person === 'alex' ? 'jamie' : 'alex'], ready: true, persistenceError: false, busy, error, refresh, signOut: onSignOut, actions };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
