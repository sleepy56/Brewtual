import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, Chip, Icon, Screen, SectionHeading } from '../components';
import { useDemo } from '../demo';
import type { RewardRequest } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { ConfirmationDialog, Notice, PageTitle } from './shared';

export default function ActivityScreen({ navigate }: ScreenProps) {
  const { person, ledger, requests, balance, actions, names, busy, mode } = useDemo();
  const { theme } = useTheme();
  const [review, setReview] = useState<RewardRequest | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState(true);
  const entries = ledger.filter(entry => entry.member === person);
  const relatedRequests = requests.filter(request => request.member === person || request.offerer === person);
  return <Screen>
    <PageTitle eyebrow="EVERY SMALL WIN COUNTS" title="Your progress, with a paper trail." />
    <Card style={{ backgroundColor: theme.surface2 }}>
      <AppText variant="eyebrow" color={theme.accent}>AVAILABLE TO ENJOY</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 }}><Icon name="token" size={28} color={theme.accent} /><AppText variant="heading" style={{ fontSize: 42 }}>{balance}</AppText><AppText color={theme.muted}>tokens</AppText></View>
      <AppText variant="caption" color={theme.muted} style={{ marginTop: 8 }}>Earned through agreed goals. Ready for a little shared joy.</AppText>
      <Button label="Explore rewards" onPress={() => navigate({ name: 'rewards' })} variant="ghost" style={{ alignSelf: 'flex-start', marginTop: 10 }} />
    </Card>
    {feedback ? <Notice tone={feedbackOk ? 'success' : 'warning'}>{feedback}</Notice> : null}
    <View style={{ marginTop: 20 }}><SectionHeading title="Plans in motion" /></View>
    {relatedRequests.length ? relatedRequests.map(request => <Card key={request.id} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="gift" color={theme.accent} size={18} /></View><View style={{ flex: 1 }}><AppText style={{ fontWeight: '600' }}>{request.title}</AppText><AppText variant="caption" color={theme.muted} style={{ marginTop: 3 }}>{names[request.member]} requested from {names[request.offerer]} · {request.date}</AppText></View><Chip label={request.status === 'fulfilled' ? 'Fulfilled' : 'Requested'} tone={request.status === 'fulfilled' ? 'accent' : 'warning'} /></View>
      <AppText variant="caption" color={theme.muted} style={{ marginTop: 13 }}>{request.expectation} · cost snapshot: {request.cost} tokens</AppText>
      {request.status === 'requested' && request.offerer === person ? <Button label="Mark fulfilled" disabled={busy} onPress={() => setReview(request)} variant="secondary" style={{ alignSelf: 'flex-start', marginTop: 9 }} /> : <AppText variant="caption" color={theme.muted} style={{ marginTop: 9 }}>{request.status === 'fulfilled' ? (request.offerer === person ? 'You marked this fulfilled.' : 'Your partner marked this fulfilled.') : `Waiting for ${names[request.offerer]} to acknowledge fulfillment.`}</AppText>}
    </Card>) : <Card><AppText variant="caption" color={theme.muted}>Your next reward request will appear here.</AppText></Card>}
    <View style={{ marginTop: 18 }}><SectionHeading title="Your token history" actionLabel="Append-only" /></View>
    <Card style={{ paddingVertical: 0 }}>
      {entries.length ? entries.map((entry, index) => <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, borderBottomWidth: index === entries.length - 1 ? 0 : 1, borderBottomColor: theme.border }}>
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={entry.amount > 0 ? 'leaf' : 'gift'} color={entry.amount > 0 ? theme.success : theme.warning} size={17} /></View>
        <View style={{ flex: 1 }}><AppText style={{ fontWeight: '500' }}>{entry.title}</AppText><AppText variant="caption" color={theme.muted} style={{ marginTop: 3 }}>{entry.detail} · {entry.date}</AppText></View>
        <AppText style={{ fontSize: 16, color: entry.amount > 0 ? theme.success : theme.warning, fontWeight: '600' }}>{entry.amount > 0 ? '+' : '−'}{Math.abs(entry.amount)}</AppText>
      </View>) : <AppText color={theme.muted} style={{ padding: 12 }}>Qualifying goal weeks add tokens here.</AppText>}
    </Card>
      <View style={{ marginTop: 12 }}><AppText variant="caption" color={theme.muted}>{mode === 'live' ? 'Records explain every award and spend. Qualifying weeks are settled in the pair timezone.' : 'Records explain every award and spend. This local demo does not grant weekly tokens automatically.'}</AppText></View>
    <ConfirmationDialog visible={!!review} title="Acknowledge this plan?" message={review ? `Mark “${review.title}” fulfilled? This records your acknowledgment. The token history stays unchanged.` : ''} confirmLabel="Mark fulfilled" onCancel={() => setReview(null)} onConfirm={() => {
      if (!review) return;
      void Promise.resolve(actions.fulfillReward(review.id)).then(result => { setFeedback(result.message); setFeedbackOk(result.ok); });
      setReview(null);
    }} />
  </Screen>;
}
