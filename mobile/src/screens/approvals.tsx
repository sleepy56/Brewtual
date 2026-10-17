import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, Chip, Screen } from '../components';
import { useDemo } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { ConfirmationDialog, Notice, PageTitle } from './shared';

export default function ApprovalsScreen({ navigate }: ScreenProps) {
  const { person, goals, actions } = useDemo();
  const { theme } = useTheme();
  const [declining, setDeclining] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState(true);
  const waiting = goals.filter(goal => goal.status === 'proposed');
  return <Screen>
    <PageTitle eyebrow="A SHARED YES" title="Make it official, together." subtitle="Review every detail before you agree." />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 13 }}><AppText variant="heading" style={{ flex: 1, fontSize: 20 }}>Agreement inbox</AppText><Chip label={`${waiting.filter(g => g.proposer !== person).length} for you`} tone="warning" /></View>
    {feedback ? <Notice tone={feedbackOk ? 'success' : 'warning'}>{feedback}</Notice> : null}
    {waiting.length ? waiting.map(goal => {
      const mine = goal.proposer === person;
      return <Card key={goal.id} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><AppText variant="eyebrow" color={theme.accent}>{goal.type === 'recurring' ? 'NEW HABIT' : 'MILESTONE'}</AppText><AppText variant="heading" style={{ fontSize: 21, marginTop: 6 }}>{goal.title}</AppText><AppText variant="caption" color={theme.muted} style={{ marginTop: 4 }}>Proposed by {goal.proposer === 'alex' ? 'Alex' : 'Jamie'}</AppText></View><Chip label="Pending" tone="warning" /></View>
        <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: theme.surface2, gap: 8 }}>
          <AppText variant="caption" color={theme.muted}>{goal.description || goal.criteria}</AppText>
          <AppText variant="caption">For {goal.owner === 'alex' ? 'Alex' : 'Jamie'} · {goal.tokens} tokens {goal.type === 'recurring' ? `· ${goal.required} of ${goal.days.map(d => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ')} days` : 'on approved completion'}</AppText>
          <AppText variant="caption" color={theme.muted}>Starts {goal.type === 'recurring' ? 'Monday, 19 October' : 'after agreement'} · Monday–Sunday week</AppText>
        </View>
        {mine ? <AppText variant="caption" color={theme.warning} style={{ marginTop: 12 }}>Waiting for your partner. You cannot approve your own proposal.</AppText> : <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
          <Button label="Agree" icon="check" onPress={() => {
            const result = actions.approveGoal(goal.id);
            setFeedback(result.message);
            setFeedbackOk(result.ok);
          }} style={{ flex: 1 }} />
          <Button label="Decline" variant="secondary" onPress={() => setDeclining(goal.id)} style={{ flex: 1 }} />
        </View>}
        <Button label="Review goal details" variant="ghost" onPress={() => navigate({ name: 'goal-detail', id: goal.id })} style={{ alignSelf: 'flex-start', marginTop: 7 }} />
      </Card>;
    }) : <Card><AppText variant="heading">All caught up.</AppText><AppText color={theme.muted} style={{ marginTop: 8 }}>Nothing needs a decision right now. Shared agreements will appear here.</AppText></Card>}
    <ConfirmationDialog visible={!!declining} title="Decline this proposal?" message="Its history will remain in Goals, and no check-ins can be made on this proposal." confirmLabel="Decline" danger onCancel={() => setDeclining(null)} onConfirm={() => {
      if (!declining) return;
      const result = actions.rejectGoal(declining);
      setDeclining(null);
      setFeedback(result.message);
      setFeedbackOk(result.ok);
    }} />
  </Screen>;
}
