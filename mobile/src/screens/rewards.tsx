import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Button, Card, Icon, Screen, SectionHeading } from '../components';
import { useDemo } from '../demo';
import type { Reward } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { ConfirmationDialog, Notice, PageTitle } from './shared';

export default function RewardsScreen({ navigate }: ScreenProps) {
  const { person, rewards, balance, actions } = useDemo();
  const { theme } = useTheme();
  const [review, setReview] = useState<{ reward: Reward; person: typeof person } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackOk, setFeedbackOk] = useState(true);
  return <Screen>
    <PageTitle eyebrow="SOMETHING TO LOOK FORWARD TO" title="Little rewards. Lovely moments." />
    {feedback ? <Notice tone={feedbackOk ? 'success' : 'warning'}>{feedback}</Notice> : null}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><AppText variant="caption" color={theme.muted}>Yours to enjoy</AppText><PressBalance amount={balance} onPress={() => navigate({ name: 'activity' })} /></View>
    <SectionHeading title="Made for each other" />
    {rewards.map(reward => {
      const ownOffer = reward.offerer === person;
      const affordable = balance >= reward.cost;
      return <Card key={reward.id} style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <View style={{ height: 95, backgroundColor: theme.accentSoft, justifyContent: 'center', alignItems: 'center' }}><Icon name={reward.glyph} size={35} color={theme.accent} strokeWidth={1.4} /></View>
        <View style={{ padding: 15, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="token" size={15} color={theme.accent} /><AppText variant="caption" color={theme.accent}>{reward.cost} tokens</AppText></View>
          <AppText style={{ fontSize: 16, fontWeight: '600' }}>{reward.title}</AppText>
          <AppText variant="caption" color={theme.muted}>{reward.description}</AppText>
          <AppText variant="caption" color={theme.muted}>Offered by {reward.offerer === 'alex' ? 'Alex' : 'Jamie'} · {reward.expectation}</AppText>
          {ownOffer ? <AppText variant="caption" color={theme.muted} style={{ marginTop: 8 }}>Your offer · for your partner</AppText> : <Button label={affordable ? 'Make a little plan' : `Need ${reward.cost - balance} more tokens`} onPress={() => {
            if (affordable) setReview({ reward, person });
          }} disabled={!affordable} variant="secondary" style={{ marginTop: 8 }} />}
        </View>
      </Card>;
    })}
    <View style={{ marginTop: 4 }}><AppText variant="caption" color={theme.muted}>The token cost is recorded when you confirm. Your partner can then acknowledge the plan in Activity.</AppText></View>
    <ConfirmationDialog visible={!!review} title="Review your little plan" message={review ? `Spend ${review.reward.cost} tokens on “${review.reward.title}”?\n\n${review.reward.expectation}\n\nYour balance will be ${balance - review.reward.cost} tokens.` : ''} confirmLabel={review ? `Spend ${review.reward.cost} tokens` : 'Confirm'} onCancel={() => setReview(null)} onConfirm={() => {
      if (!review) return;
      const result = actions.requestReward(review.reward.id, review.person);
      setReview(null);
      setFeedback(result.message);
      setFeedbackOk(result.ok);
    }} />
  </Screen>;
}

function PressBalance({ amount, onPress }: { amount: number; onPress: () => void }) {
  const { theme } = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${amount} tokens. View activity`} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="token" color={theme.accent} size={16} /><AppText color={theme.accent} style={{ fontWeight: '600' }}>{amount} tokens</AppText><Icon name="arrow" color={theme.accent} size={14} /></Pressable>;
}
