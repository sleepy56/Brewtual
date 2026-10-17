import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, Chip, Icon, Screen } from '../components';
import { useDemo } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { GoalTile, Notice, PageTitle } from './shared';

export default function GoalDetailScreen({ route, navigate }: ScreenProps) {
  const { person, goals, actions, today, timezone, names, busy, mode } = useDemo();
  const { theme } = useTheme();
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState(true);
  const goal = goals.find(item => item.id === route.id);
  if (!goal) return <Screen><PageTitle title="Goal not found." subtitle={mode === 'demo' ? 'It may have been removed from the local demo. Return to your goals to continue.' : 'This goal may no longer be available. Refresh your shared space and try again.'} /><Button label="Back to goals" icon="back" onPress={() => navigate({ name: 'goals' })} variant="secondary" /></Screen>;
  const status = goal.status === 'proposed' ? 'Pending approval' : goal.status === 'scheduled' ? `Starts ${goal.startDate}` : goal.status === 'rejected' ? 'Declined' : goal.status === 'active' ? `Agreed with ${names[goal.owner === 'alex' ? 'jamie' : 'alex']}` : 'Completed';
  return <Screen>
    <PageTitle eyebrow="THE AGREEMENT" title={goal.title} subtitle={goal.description} />
    {feedback ? <Notice tone={feedbackOk ? 'success' : 'warning'}>{feedback}</Notice> : null}
    <GoalTile goal={goal} person={person} interactive={false} onCheck={() => { if (busy) return; void (async () => {
      const result = await (goal.checks.includes(today) ? actions.undoCheckIn(goal.id) : actions.checkIn(goal.id));
      setFeedback(result.message); setFeedbackOk(result.ok);
    })(); }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}><AppText variant="heading" style={{ fontSize: 20 }}>{goal.status === 'proposed' ? 'Proposed terms' : 'Agreed terms'}</AppText><Chip label={status} tone={goal.status === 'active' ? 'accent' : 'warning'} /></View>
    <Card style={{ gap: 13 }}>
      <Term label="Owner" value={names[goal.owner]} />
      <Term label="Token award" value={`${goal.tokens} tokens`} />
      {goal.type === 'recurring' ? <><Term label="Scheduled days" value={goal.days.map(day => ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][day]).join(', ')} /><Term label="Weekly target" value={`${goal.required} of ${goal.days.length} days`} /></> : <Term label="Done means" value={goal.criteria || goal.description} />}
      <Term label="Starts" value={goal.startDate || 'On agreement'} />
      <Term label="Week / time zone" value={`Monday–Sunday · ${timezone}`} />
    </Card>
    <Card style={{ marginTop: 13, backgroundColor: theme.surface2 }}>
      <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}><Icon name="clock" size={17} color={theme.accent} /><View style={{ flex: 1 }}><AppText variant="caption" color={theme.muted}>{goal.type === 'recurring' ? `Complete the target during a Monday–Sunday week in ${timezone}. Tokens are settled after the week closes.` : 'Only the goal owner can claim completion. Partner review and milestone awards are planned for a later service-backed version.'}</AppText></View></View>
    </Card>
    {goal.status === 'proposed' && goal.proposer !== person ? <Button label="Review this agreement" onPress={() => navigate({ name: 'approvals' })} style={{ marginTop: 13 }} /> : null}
  </Screen>;
}

function Term({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 11 }}><AppText variant="caption" color={theme.muted} style={{ flex: 1 }}>{label}</AppText><AppText variant="caption" style={{ flex: 1, textAlign: 'right' }}>{value}</AppText></View>;
}
