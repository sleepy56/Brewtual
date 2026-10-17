import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { AppText, Button, Card, PlantArt, Screen, SectionHeading } from '../components';
import { useDemo } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { BalancePill, GoalTile, Notice, PageTitle, PartnerLine } from './shared';
import { addDays, displayDate, weekday, weekStart } from '../live/calendar';

export default function TodayScreen({ navigate }: ScreenProps) {
  const { person, goals, balance, pendingCount, partnerName, today, timezone, busy, actions } = useDemo();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const plantSize = width < 360 ? 92 : 119;
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState(true);
  const mine = goals.filter(goal => goal.owner === person && goal.status === 'active' && goal.type === 'recurring' && goal.days.includes(weekday(today)));
  const partner = person === 'alex' ? 'jamie' : 'alex';
  const partnerGoals = goals.filter(goal => goal.owner === partner && goal.status === 'active');
  const monday = weekStart(today);
  const completed = partnerGoals.reduce((sum, goal) => sum + goal.checks.filter(date => date >= monday && date <= addDays(monday, 6)).length, 0);
  return <Screen>
    <PageTitle eyebrow={displayDate(today, timezone).toUpperCase()} title="A little better, together." subtitle="Make room for a small win today." />
    <Card style={{ backgroundColor: theme.heroBg, borderColor: theme.heroBg, padding: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', minHeight: 176, alignItems: 'center', paddingVertical: 18, paddingLeft: 19, paddingRight: 4 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <AppText variant="eyebrow" color={theme.heroMuted}>ONE DAY AT A TIME</AppText>
          <AppText variant="heading" color={theme.heroText} style={{ fontSize: 25, lineHeight: 30 }}>Small steps.{ '\n' }Shared wins.</AppText>
          <AppText variant="caption" color={theme.heroMuted}>A little progress today.{ '\n' }A shared moment ahead.</AppText>
          <BalancePill amount={balance} onPress={() => navigate({ name: 'activity' })} tone="hero" />
        </View>
        <PlantArt size={plantSize} />
      </View>
    </Card>
    <View style={{ marginTop: 24 }}>
      <SectionHeading title="Your focus today" actionLabel="New goal" onAction={() => navigate({ name: 'new-goal' })} />
    </View>
    {feedback ? <Notice tone={feedbackOk ? 'success' : 'warning'}>{feedback}</Notice> : null}
    {pendingCount > 0 ? <Notice tone="warning">{pendingCount} agreement{pendingCount === 1 ? '' : 's'} waiting for your review. A shared plan starts with a shared yes.</Notice> : null}
    {mine.length ? mine.map(goal => <GoalTile key={goal.id} goal={goal} person={person} onPress={() => navigate({ name: 'goal-detail', id: goal.id })} onCheck={() => { if (busy) return; void (async () => {
      const result = await (goal.checks.includes(today) ? actions.undoCheckIn(goal.id) : actions.checkIn(goal.id));
      setFeedback(result.message);
      setFeedbackOk(result.ok);
    })(); }} />) : <Card><AppText variant="heading">Make room for a small win.</AppText><AppText color={theme.muted} style={{ marginVertical: 12 }}>Agree on your first goal together. Start with something manageable.</AppText><Button label="Propose a goal" icon="plus" onPress={() => navigate({ name: 'new-goal' })} variant="ghost" style={{ alignSelf: 'flex-start' }} /></Card>}
    <View style={{ marginVertical: 7 }}><Notice>Your week runs Monday–Sunday. Check-ins record progress; tokens arrive after the week closes.</Notice></View>
    <Card>
      <PartnerLine person={partner}>
        <AppText style={{ fontWeight: '600' }}>{partnerName}’s little wins</AppText>
        <AppText variant="caption" color={theme.muted} style={{ marginTop: 4 }}>A glimpse of your teammate’s week</AppText>
      </PartnerLine>
      <AppText variant="heading" style={{ marginTop: 16 }}>{completed} check-ins this week</AppText>
      <AppText variant="caption" color={theme.muted}>Keep cheering each other on.</AppText>
      <Button label={`See ${partnerName}’s goals`} icon="arrow" onPress={() => navigate({ name: 'goals', goalOwner: 'partner' })} variant="ghost" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
    </Card>
  </Screen>;
}
