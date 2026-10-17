import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Button, Card, Chip, Screen } from '../components';
import { useDemo } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { GoalTile, PageTitle } from './shared';

export default function GoalsScreen({ navigate, route }: ScreenProps) {
  const { person, goals, partnerName } = useDemo();
  const { theme } = useTheme();
  const [owner, setOwner] = useState<'me' | 'partner' | 'both'>(route.goalOwner ?? 'me');
  const [showPending, setShowPending] = useState(false);
  const visible = goals.filter(goal => (owner === 'both' || (owner === 'me' ? goal.owner === person : goal.owner !== person)) && (showPending ? ['proposed', 'scheduled', 'rejected'].includes(goal.status) : ['active', 'scheduled'].includes(goal.status)));
  const option = (value: typeof owner, label: string) => <Pressable key={value} onPress={() => setOwner(value)} accessibilityRole="radio" accessibilityState={{ checked: owner === value }} aria-checked={owner === value} style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: owner === value ? theme.accentSoft : 'transparent' }}><AppText variant="caption" color={owner === value ? theme.accent : theme.muted}>{label}</AppText></Pressable>;
  return <Screen>
    <PageTitle eyebrow="GROW AT YOUR PACE" title="Good things take a little practice." subtitle="Your agreements, with room to change." />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><AppText variant="heading" style={{ flex: 1, fontSize: 20 }}>Your goals</AppText><Button label="New goal" icon="plus" onPress={() => navigate({ name: 'new-goal' })} variant="ghost" /></View>
    <View style={{ flexDirection: 'row', borderRadius: 22, padding: 3, backgroundColor: theme.surface2, marginBottom: 12 }}>{option('me', 'Mine')}{option('partner', partnerName)}{option('both', 'Both')}</View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}><AppText variant="caption" color={theme.muted}>Show:</AppText><Pressable onPress={() => setShowPending(value => !value)} accessibilityRole="button" accessibilityLabel="Toggle goal status filter" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, minHeight: 44, borderWidth: 1, borderColor: theme.border, borderRadius: 22 }}><AppText variant="caption">{showPending ? 'Waiting & history' : 'Active goals'}</AppText><Chip label={showPending ? '↑' : '↓'} tone="muted" /></Pressable></View>
    {visible.length ? visible.map(goal => <GoalTile key={goal.id} goal={goal} person={person} onPress={() => navigate({ name: 'goal-detail', id: goal.id })} />) : <Card><AppText variant="heading">A fresh little start.</AppText><AppText color={theme.muted} style={{ marginTop: 8 }}>No goals match this view. Propose something you can agree on together.</AppText></Card>}
  </Screen>;
}
