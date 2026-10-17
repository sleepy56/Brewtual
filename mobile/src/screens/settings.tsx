import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Avatar, Button, Card, Chip, Icon, Screen } from '../components';
import { useDemo } from '../demo';
import { themes, useTheme } from '../theme';
import type { ThemeName } from '../theme';
import type { ScreenProps } from '../types';
import { ConfirmationDialog, Notice, PageTitle } from './shared';

const choices: { name: ThemeName; title: string; caption: string }[] = [
  { name: 'midnight', title: 'Midnight garden', caption: 'Calm & deep' },
  { name: 'dawn', title: 'Soft dawn', caption: 'Soft & light' },
  { name: 'plum', title: 'Evening plum', caption: 'Gentle & warm' },
  { name: 'ocean', title: 'Quiet ocean', caption: 'Cool & steady' },
];

export default function SettingsScreen(_: ScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { theme, themeName, setTheme, persistenceError: themePersistenceError } = useTheme();
  const { person, actions, persistenceError } = useDemo();
  const partner = person === 'alex' ? 'jamie' : 'alex';
  const personName = person === 'alex' ? 'Alex' : 'Jamie';
  return <Screen>
    <PageTitle eyebrow="MAKE YOURSELF AT HOME" title="Your little corner of the app." subtitle="A few preferences, a little personality." />
    {persistenceError || themePersistenceError ? <Notice tone="warning">This device could not save some demo preferences. Your changes remain visible while the app stays open; storage will be retried after another change.</Notice> : null}
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}><View style={{ flexDirection: 'row' }}><Avatar person="alex" size={36} /><View style={{ marginLeft: -8 }}><Avatar person="jamie" size={36} /></View></View><View style={{ flex: 1, minWidth: 0 }}><AppText style={{ fontWeight: '600' }}>Our little team</AppText><AppText variant="caption" color={theme.muted} style={{ marginTop: 3 }}>Alex + Jamie · fictional demo</AppText></View></View>
      <View style={{ alignItems: 'flex-end', marginTop: 10 }}><Chip label="LOCAL DEMO" tone="muted" /></View>
    </Card>
    <View style={{ marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><AppText variant="heading" style={{ fontSize: 20 }}>Set the mood</AppText><Chip label="This device" tone="muted" /></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
      {choices.map(choice => {
        const selected = themeName === choice.name;
        const palette = themes[choice.name];
        return <Pressable key={choice.name} onPress={() => setTheme(choice.name)} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={`${choice.title}, ${selected ? 'selected' : choice.caption}`} style={{ width: '48%', minHeight: 126, borderRadius: 17, padding: 11, borderWidth: selected ? 2 : 1, borderColor: selected ? theme.accent : theme.border, backgroundColor: theme.surface }}>
          <View style={{ height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: palette.bg, flexDirection: 'row', padding: 8, gap: 5 }}><View style={{ width: '54%', height: 36, borderRadius: 8, backgroundColor: palette.accent }} /><View style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: palette.surface2 }} /></View>
          <AppText style={{ fontWeight: '600', marginTop: 8, fontSize: 12 }}>{choice.title}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}><AppText variant="caption" color={theme.muted}>{selected ? 'Selected' : choice.caption}</AppText>{selected ? <Icon name="check" size={13} color={theme.accent} /> : null}</View>
        </Pressable>;
      })}
    </View>
    <AppText variant="caption" color={theme.muted} style={{ marginTop: 11 }}>{themePersistenceError ? 'Theme changes are not being saved on this device right now.' : 'Appearance is saved on this device.'} Changing demo person does not change the selected theme.</AppText>
    <View style={{ marginTop: 23, marginBottom: 10 }}><AppText variant="heading" style={{ fontSize: 20 }}>Preview as</AppText></View>
    <Card style={{ gap: 9 }}>
      <AppText variant="caption" color={theme.muted}>Switch between fictional members to review the partner view.</AppText>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Button label="Alex" onPress={() => actions.switchPerson('alex')} variant={person === 'alex' ? 'primary' : 'secondary'} style={{ flex: 1 }} />
        <Button label="Jamie" onPress={() => actions.switchPerson('jamie')} variant={person === 'jamie' ? 'primary' : 'secondary'} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 }}><Avatar person={person} size={36} /><View><AppText style={{ fontWeight: '600' }}>{personName} is viewing</AppText><AppText variant="caption" color={theme.muted}>Partner: {partner === 'alex' ? 'Alex' : 'Jamie'}</AppText></View></View>
    </Card>
    <View style={{ marginTop: 23, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><AppText variant="heading" style={{ fontSize: 20 }}>Demo data</AppText><Chip label="Fictional only" tone="warning" /></View>
    <Card>
      <AppText color={theme.muted} style={{ fontSize: 12, lineHeight: 19 }}>{persistenceError ? 'This device could not save the latest demo data; it remains available while the app stays open.' : 'Settings, balances, agreements and activity are saved locally for this demo.'} Preview date: Wednesday, 14 October 2026. No account is connected.</AppText>
      <Button label="Reset demo to starting data" icon="close" variant="secondary" style={{ marginTop: 15 }} onPress={() => setConfirmReset(true)} />
    </Card>
    <ConfirmationDialog visible={confirmReset} title="Reset demo data?" message="This restores Alex and Jamie’s original fictional goals, balances and reward requests on this device." confirmLabel="Reset demo" danger onCancel={() => setConfirmReset(false)} onConfirm={() => { actions.resetDemo(); setConfirmReset(false); }} />
  </Screen>;
}
