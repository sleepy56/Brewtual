import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, Chip, Screen } from '../components';
import { useDemo } from '../demo';
import { displayDate } from '../live/calendar';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { ConfirmationDialog, Notice, PageTitle } from './shared';

export default function ApprovalsScreen({ navigate }: ScreenProps) {
  const { person, goals, rewards, names, busy, timezone, actions } = useDemo();
  const { theme } = useTheme();
  const [declining, setDeclining] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState(true);
  const waiting = goals.filter(goal => goal.status === 'proposed');
  const waitingRewards = rewards.filter(reward => reward.status === 'proposed');
  const decide = async (action: () => ReturnType<typeof actions.approveGoal>) => {
    const result = await action(); setFeedback(result.message); setFeedbackOk(result.ok);
  };
  return <Screen>
    <PageTitle eyebrow="A SHARED YES" title="Make it official, together." subtitle="Review every detail before you agree." />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 13 }}><AppText variant="heading" style={{ flex: 1, fontSize: 20 }}>Agreement inbox</AppText><Chip label={`${waiting.filter(g => g.proposer !== person).length + waitingRewards.filter(r => r.offerer !== person).length} for you`} tone="warning" /></View>
    {feedback ? <Notice tone={feedbackOk ? 'success' : 'warning'}>{feedback}</Notice> : null}
    {waiting.length || waitingRewards.length ? <>
      {waiting.map(goal => <Card key={goal.id} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><AppText variant="eyebrow" color={theme.accent}>NEW HABIT</AppText><AppText variant="heading" style={{ fontSize: 21, marginTop: 6 }}>{goal.title}</AppText><AppText variant="caption" color={theme.muted} style={{ marginTop: 4 }}>Proposed by {names[goal.proposer]}</AppText></View><Chip label="Pending" tone="warning" /></View>
        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: theme.surface2, gap: 8 }}><AppText variant="caption" color={theme.muted}>{goal.description}</AppText><AppText variant="caption">For {names[goal.owner]} · {goal.tokens} tokens · {goal.required} of {goal.days.map(d => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ')} days</AppText><AppText variant="caption" color={theme.muted}>Starts {goal.startDate ? displayDate(goal.startDate, timezone) : 'after approval'} · Monday–Sunday week</AppText></View>
        {goal.proposer === person ? <AppText variant="caption" color={theme.warning} style={{ marginTop: 12 }}>Waiting for your partner.</AppText> : <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}><Button label="Agree" icon="check" disabled={busy} onPress={() => void decide(() => actions.approveGoal(goal.id))} style={{ flex: 1 }} /><Button label="Decline" variant="secondary" disabled={busy} onPress={() => setDeclining(goal.id)} style={{ flex: 1 }} /></View>}
        <Button label="Review goal details" variant="ghost" onPress={() => navigate({ name: 'goal-detail', id: goal.id })} style={{ alignSelf: 'flex-start', marginTop: 7 }} />
      </Card>)}
      {waitingRewards.map(reward => <Card key={reward.id} style={{ marginBottom: 14 }}><AppText variant="eyebrow" color={theme.accent}>NEW REWARD</AppText><AppText variant="heading" style={{ fontSize: 21, marginTop: 6 }}>{reward.title}</AppText><AppText variant="caption" color={theme.muted}>Offered by {names[reward.offerer]}</AppText><AppText style={{ marginTop: 10 }}>{reward.description}</AppText><AppText variant="caption" color={theme.muted}>{reward.cost} tokens · {reward.expectation}</AppText>{reward.offerer === person ? <AppText color={theme.warning}>Waiting for your partner.</AppText> : <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><Button label="Agree" disabled={busy} onPress={() => void decide(() => actions.approveReward(reward.id))} style={{ flex: 1 }} /><Button label="Decline" disabled={busy} variant="secondary" onPress={() => void decide(() => actions.rejectReward(reward.id))} style={{ flex: 1 }} /></View>}</Card>)}
    </> : <Card><AppText variant="heading">All caught up.</AppText><AppText color={theme.muted} style={{ marginTop: 8 }}>Nothing needs a decision right now. Shared agreements will appear here.</AppText></Card>}
    <ConfirmationDialog visible={!!declining} title="Decline this proposal?" message="Its history will remain in Goals, and no check-ins can be made on this proposal." confirmLabel="Decline" danger onCancel={() => setDeclining(null)} onConfirm={() => { if (!declining) return; void decide(() => actions.rejectGoal(declining)); setDeclining(null); }} />
  </Screen>;
}
