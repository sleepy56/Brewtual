import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AppText, Button, Card, Icon, Screen } from '../components';
import { useDemo } from '../demo';
import type { GoalType } from '../demo';
import { useTheme } from '../theme';
import type { ScreenProps } from '../types';
import { PageTitle } from './shared';

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function NewGoalScreen({ navigate, goBack }: ScreenProps) {
  const { person, partnerName, actions } = useDemo();
  const { theme } = useTheme();
  const [type, setType] = useState<GoalType>('recurring');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState(person);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [required, setRequired] = useState('3');
  const [tokens, setTokens] = useState('2');
  const [criteria, setCriteria] = useState('');
  const [glyph, setGlyph] = useState<'gym' | 'book' | 'leaf' | 'mountain'>('leaf');
  const [error, setError] = useState('');
  const fieldStyle = { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 } as const;
  const toggleDay = (day: number) => setDays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day].sort());
  return <Screen>
    <>
      <PageTitle eyebrow="MAKE A SHARED PLAN" title="Start with a small promise." subtitle="Every term is a conversation. Your partner gets the final say." />
      <View style={{ flexDirection: 'row', backgroundColor: theme.surface2, borderRadius: 12, padding: 3, marginBottom: 17 }}>
        {(['recurring', 'milestone'] as const).map(value => <Pressable key={value} onPress={() => { setType(value); setError(''); }} accessibilityRole="radio" accessibilityState={{ checked: type === value }} aria-checked={type === value} accessibilityLabel={value === 'recurring' ? 'Recurring habit' : 'Milestone'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 10, backgroundColor: type === value ? theme.surface : 'transparent' }}><AppText variant="caption" color={type === value ? theme.text : theme.muted}>{value === 'recurring' ? 'Recurring habit' : 'Milestone'}</AppText></Pressable>)}
      </View>
      <Field label="Give it a name" theme={theme}>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. A 20-minute evening walk" placeholderTextColor={theme.muted} maxLength={80} style={fieldStyle} returnKeyType="next" accessibilityLabel="Goal name" />
      </Field>
      <Field label="Who is this goal for?" theme={theme}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['alex', 'jamie'] as const).map(member => <Pressable key={member} onPress={() => setOwner(member)} accessibilityRole="radio" accessibilityState={{ checked: owner === member }} aria-checked={owner === member} style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: owner === member ? theme.accent : theme.border, backgroundColor: owner === member ? theme.accentSoft : theme.surface, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" color={owner === member ? theme.accent : theme.text}>{member === 'alex' ? 'Alex' : 'Jamie'}{member === person ? ' · you' : ''}</AppText></Pressable>)}
        </View>
      </Field>
      <Field label="A little more detail · optional" theme={theme}>
        <TextInput value={description} onChangeText={setDescription} placeholder="What would feel like a good small step?" placeholderTextColor={theme.muted} maxLength={240} multiline style={[fieldStyle, { minHeight: 76, textAlignVertical: 'top' }]} accessibilityLabel="Goal description" />
      </Field>
      {type === 'recurring' ? <>
        <Field label="Which days?" theme={theme}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {dayLabels.map((label, index) => <Pressable key={index} onPress={() => toggleDay(index)} accessibilityRole="checkbox" accessibilityState={{ checked: days.includes(index) }} aria-checked={days.includes(index)} style={{ flex: 1, minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: days.includes(index) ? theme.accent : theme.border, backgroundColor: days.includes(index) ? theme.accent : theme.surface, alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" color={days.includes(index) ? theme.accentText : theme.muted}>{label}</AppText></Pressable>)}
          </View>
        </Field>
        <View style={{ flexDirection: 'row', gap: 11 }}>
          <Field label="Days needed / week" theme={theme} style={{ flex: 1 }}><TextInput value={required} onChangeText={setRequired} keyboardType="number-pad" maxLength={1} style={fieldStyle} accessibilityLabel="Days needed per week" /></Field>
          <Field label="Tokens per week" theme={theme} style={{ flex: 1 }}><TextInput value={tokens} onChangeText={setTokens} keyboardType="number-pad" maxLength={2} style={fieldStyle} accessibilityLabel="Tokens per week" /></Field>
        </View>
        <AppText variant="caption" color={theme.muted} style={{ marginTop: -5, marginBottom: 15 }}>The target must fit your scheduled days. Weeks run Monday–Sunday.</AppText>
      </> : <>
        <Field label="What does “done” mean?" theme={theme}>
          <TextInput value={criteria} onChangeText={setCriteria} placeholder="Describe the outcome your partner will review." placeholderTextColor={theme.muted} maxLength={360} multiline style={[fieldStyle, { minHeight: 83, textAlignVertical: 'top' }]} accessibilityLabel="Milestone completion criteria" />
        </Field>
        <Field label="Tokens on approved completion" theme={theme}><TextInput value={tokens} onChangeText={setTokens} keyboardType="number-pad" maxLength={2} style={fieldStyle} accessibilityLabel="Tokens on completion" /></Field>
      </>}
      <View style={{ gap: 7, marginBottom: 13 }}><AppText variant="caption" color={theme.muted}>Choose an icon</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{(['leaf', 'gym', 'book', 'mountain'] as const).map(name => <Pressable key={name} onPress={() => setGlyph(name)} accessibilityRole="radio" accessibilityState={{ checked: glyph === name }} aria-checked={glyph === name} accessibilityLabel={`${name} icon`} style={{ padding: 9, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: glyph === name ? theme.accentSoft : theme.surface2 }}><Icon name={name} size={18} color={glyph === name ? theme.accent : theme.muted} /></Pressable>)}</View></View>
      <Card style={{ backgroundColor: theme.surface2, marginBottom: 13 }}><AppText variant="eyebrow" color={theme.accent}>YOUR SHARED AGREEMENT</AppText><AppText style={{ fontWeight: '600', marginTop: 7 }}>{title || 'Your new goal'}</AppText><AppText variant="caption" color={theme.muted} style={{ marginTop: 5 }}>{owner === 'alex' ? 'Alex' : 'Jamie'} · {type === 'recurring' ? `${days.map(day => dayLabels[day]).join(', ') || 'Choose scheduled days'} · complete ${required || '0'} of ${days.length} days · earn ${tokens || '0'} tokens after a qualifying week closes.` : `Earn ${tokens || '0'} tokens once your partner approves completion.`}</AppText></Card>
      {error ? <AppText color={theme.danger} style={{ marginBottom: 12 }}>{error}</AppText> : null}
      <AppText variant="caption" color={theme.muted} style={{ marginBottom: 12 }}>{type === 'recurring' ? 'If approved today, terms begin Monday, 19 October.' : `Your partner, ${partnerName}, reviews the milestone terms.`}</AppText>
      <Button label={`Send to ${partnerName} for approval`} icon="arrow" onPress={() => {
        const result = actions.proposeGoal({ title, description, owner, type, days: type === 'milestone' ? [] : days, required: type === 'milestone' ? 1 : Number(required), tokens: Number(tokens), criteria, glyph });
        if (!result.ok) { setError(result.message); return; }
        navigate({ name: 'goal-detail', id: result.goalId });
      }} />
      <Button label="Cancel" variant="ghost" onPress={goBack} style={{ marginTop: 4 }} />
    </>
  </Screen>;
}

function Field({ label, children, theme, style }: React.PropsWithChildren<{ label: string; theme: { muted: string }; style?: StyleProp<ViewStyle> }>) {
  return <View style={[{ gap: 7, marginBottom: 15 }, style]}><AppText variant="caption" color={theme.muted}>{label}</AppText>{children}</View>;
}
