import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Avatar, Button, Card, Chip, Icon, SectionHeading } from '../components';
import { useTheme } from '../theme';
import type { Goal, GoalStatus } from '../demo';
import type { PersonId } from '../types';

export function PageTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { theme } = useTheme();
  return <View style={styles.titleBlock}>
    {eyebrow ? <AppText variant="eyebrow" color={theme.accent}>{eyebrow}</AppText> : null}
    <AppText variant="heading" style={{ fontSize: 31, lineHeight: 37 }}>{title}</AppText>
    {subtitle ? <AppText color={theme.muted} style={styles.subtitle}>{subtitle}</AppText> : null}
  </View>;
}

export function Section({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return <SectionHeading title={title} actionLabel={actionLabel} onAction={onAction} />;
}

export function GoalTile({ goal, person, onPress, onCheck, interactive = true }: { goal: Goal; person: PersonId; onPress?: () => void; onCheck?: () => void; interactive?: boolean }) {
  const { theme } = useTheme();
  const checkedToday = goal.checks.includes('2026-10-14');
  const currentWeekCount = goal.checks.filter(date => date >= '2026-10-12' && date <= '2026-10-18').length;
  const statusLabel: Record<GoalStatus, string> = {
    active: `+${goal.tokens} tokens`, proposed: 'Needs a yes', scheduled: 'Starts 19 Oct', rejected: 'Declined', 'claim-pending': 'Review pending', complete: 'Complete',
  };
  return <Card style={styles.goalCard}>
    <View style={styles.goalHeader}>
      <View style={[styles.goalGlyph, { backgroundColor: theme.accentSoft }]}><Icon name={goal.glyph} color={theme.accent} size={19} /></View>
      {interactive ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${goal.title}`} style={styles.goalName}>
        <AppText style={styles.goalTitle}>{goal.title}</AppText>
        <AppText variant="caption" color={theme.muted}>{goal.type === 'recurring' ? `${goal.days.map(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(' · ')}  ·  ${goal.required} days / week` : 'One-time milestone'}{goal.owner !== person ? `  ·  ${goal.owner === 'alex' ? 'Alex' : 'Jamie'}` : ''}</AppText>
      </Pressable> : <View style={styles.goalName}>
        <AppText style={styles.goalTitle}>{goal.title}</AppText>
        <AppText variant="caption" color={theme.muted}>{goal.type === 'recurring' ? `${goal.days.map(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(' · ')}  ·  ${goal.required} days / week` : 'One-time milestone'}{goal.owner !== person ? `  ·  ${goal.owner === 'alex' ? 'Alex' : 'Jamie'}` : ''}</AppText>
      </View>}
      <Chip label={statusLabel[goal.status]} tone={goal.status === 'active' ? 'accent' : 'muted'} />
    </View>
    {goal.type === 'recurring' && goal.status === 'active' ? <>
      <View style={styles.weekRow}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => {
        const date = `2026-10-${String(12 + index).padStart(2, '0')}`;
        const done = goal.checks.includes(date);
        const scheduled = goal.days.includes(index);
        const currentDay = index === 2;
        return <View key={`${index}-${label}`} style={styles.weekDay}>
          <AppText variant="caption" color={theme.muted} style={{ fontSize: 9 }}>{label}</AppText>
          <View style={[styles.dayCircle, { backgroundColor: done ? theme.accent : theme.surface, borderColor: currentDay ? theme.accent : theme.border }]}><AppText variant="caption" color={done ? theme.accentText : scheduled ? theme.text : theme.muted} style={{ fontSize: 10, fontWeight: currentDay ? '700' : '400' }}>{done ? '✓' : 12 + index}</AppText></View>
        </View>;
      })}</View>
      <View style={styles.progressText}><AppText variant="caption" color={theme.muted}>{currentWeekCount} of {goal.required} needed this week</AppText><AppText variant="caption" color={theme.accent}>{Math.max(0, goal.required - currentWeekCount)} to go</AppText></View>
      <View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.trackFill, { backgroundColor: theme.accent, width: `${Math.min(100, currentWeekCount / goal.required * 100)}%` }]} /></View>
    </> : <AppText color={theme.muted} style={styles.goalDescription}>{goal.description}</AppText>}
    <View style={[styles.goalBottom, { borderTopColor: theme.border }]}>
      <AppText variant="caption" color={theme.muted}>{goal.status === 'active' ? 'Awarded after Sunday' : goal.status === 'proposed' ? 'Waiting for partner approval' : 'Agreement details'}</AppText>
      {goal.owner === person && goal.type === 'recurring' && goal.status === 'active' && goal.days.includes(2) && onCheck ? <Button label={checkedToday ? 'Done today · Undo' : 'Mark done'} onPress={onCheck} variant={checkedToday ? 'secondary' : 'primary'} icon={checkedToday ? 'check' : 'plus'} /> : interactive ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${goal.title}`} style={[styles.viewLink, { flexDirection: 'row', alignItems: 'center' }]}><AppText color={theme.accent}>View</AppText><Icon name="arrow" color={theme.accent} size={14} /></Pressable> : null}
    </View>
  </Card>;
}

export function BalancePill({ amount, onPress, tone = 'default' }: { amount: number; onPress: () => void; tone?: 'default' | 'hero' }) {
  const { theme } = useTheme();
  const fg = tone === 'hero' ? theme.heroText : theme.accent;
  const secondary = tone === 'hero' ? theme.heroMuted : theme.muted;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${amount} tokens. View activity`} style={[styles.balancePill, { backgroundColor: tone === 'hero' ? 'transparent' : theme.accentSoft, borderColor: tone === 'hero' ? theme.heroMuted : theme.border }]}>
    <Icon name="token" size={17} color={fg} /><AppText color={fg} style={{ fontWeight: '600' }}>{amount}</AppText><AppText variant="caption" color={secondary}> tokens</AppText><Icon name="arrow" size={14} color={fg} />
  </Pressable>;
}

export function Notice({ children, tone = 'muted' }: React.PropsWithChildren<{ tone?: 'muted' | 'warning' | 'success' }>) {
  const { theme } = useTheme();
  const color = tone === 'warning' ? theme.warning : tone === 'success' ? theme.success : theme.muted;
  return <View style={[styles.notice, { backgroundColor: theme.surface2, borderColor: theme.border }]}><Icon name={tone === 'success' ? 'check' : 'heart'} size={16} color={color} /><View style={{ flex: 1 }}><AppText variant="caption" color={theme.muted}>{children}</AppText></View></View>;
}

export function PartnerLine({ person, children }: React.PropsWithChildren<{ person: PersonId }>) {
  return <View style={styles.partnerLine}><Avatar person={person} size={38} /><View style={{ flex: 1 }}>{children}</View></View>;
}

export function ConfirmationDialog({ visible, title, message, confirmLabel, onCancel, onConfirm, danger = false }: { visible: boolean; title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }) {
  const { theme } = useTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <View style={styles.modalBackdrop}>
      <Card accessibilityViewIsModal style={{ width: '100%', maxWidth: 360, marginBottom: 0, padding: 20 }}>
        <AppText variant="heading" style={{ fontSize: 23 }}>{title}</AppText>
        <AppText color={theme.muted} style={{ fontSize: 13, lineHeight: 20, marginTop: 9, marginBottom: 19 }}>{message}</AppText>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }} />
        </View>
      </Card>
    </View>
  </Modal>;
}

export const styles = StyleSheet.create({
  titleBlock: { marginTop: 2, marginBottom: 20, gap: 8 }, subtitle: { fontSize: 13, lineHeight: 21 },
  goalCard: { marginBottom: 13 }, goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, goalGlyph: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, goalName: { flex: 1, gap: 4, minHeight: 44, justifyContent: 'center' }, goalTitle: { fontSize: 15, fontWeight: '600' }, goalDescription: { fontSize: 12, lineHeight: 20, marginTop: 13 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2, marginTop: 15 }, weekDay: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 45, gap: 3 }, dayCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, progressText: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, track: { height: 5, borderRadius: 4, overflow: 'hidden', marginTop: 8 }, trackFill: { height: '100%', borderRadius: 4 }, goalBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth }, viewLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, balancePill: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1 }, notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 13, borderRadius: 12, borderWidth: 1, marginBottom: 14 }, partnerLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalBackdrop: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 20 },
});
