import { AuthGate } from './src/auth/gate';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BrewtualMark, AppText, Avatar, Button, Icon, IconButton, IconName } from './src/components';
import { useDemo } from './src/demo';
import { ThemeProvider, useTheme } from './src/theme';
import { Route, TabName } from './src/types';
import TodayScreen from './src/screens/today';
import GoalsScreen from './src/screens/goals';
import RewardsScreen from './src/screens/rewards';
import ActivityScreen from './src/screens/activity';
import SettingsScreen from './src/screens/settings';
import ApprovalsScreen from './src/screens/approvals';
import NewGoalScreen from './src/screens/new-goal';
import GoalDetailScreen from './src/screens/goal-detail';

const tabs: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'today', label: 'Today', icon: 'home' },
  { name: 'goals', label: 'Goals', icon: 'target' },
  { name: 'rewards', label: 'Rewards', icon: 'gift' },
  { name: 'activity', label: 'Activity', icon: 'activity' },
];
const screens = { today: TodayScreen, goals: GoalsScreen, rewards: RewardsScreen, activity: ActivityScreen,
  settings: SettingsScreen, approvals: ApprovalsScreen, 'new-goal': NewGoalScreen, 'goal-detail': GoalDetailScreen };

function AppShell() {
  const { theme, ready: themeReady, persistenceError: themeSaveError } = useTheme();
  const { person, names, mode, pendingCount, ready: demoReady, persistenceError: demoSaveError, busy, error, refresh } = useDemo();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [history, setHistory] = useState<Route[]>([{ name: 'today' }]);
  const [activeTab, setActiveTab] = useState<TabName>('today');
  const route = history[history.length - 1];
  const navigate = useCallback((next: Route) => {
    if (tabs.some(tab => tab.name === next.name)) {
      setActiveTab(next.name as TabName);
      setHistory([next]);
    } else {
      setHistory(current => {
        const previous = current[current.length - 1];
        if (previous.name === next.name && previous.id === next.id) return current;
        if (previous.name === 'new-goal' && next.name === 'goal-detail') return [...current.slice(0, -1), next];
        return [...current, next];
      });
    }
  }, []);
  const goBack = useCallback(() => setHistory(current => current.length > 1 ? current.slice(0, -1) : [{ name: activeTab }]), [activeTab]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (history.length <= 1) return false;
      goBack(); return true;
    });
    return () => subscription.remove();
  }, [goBack, history.length]);

  if (!themeReady || !demoReady) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}><ActivityIndicator color={theme.accent} accessibilityLabel="Opening brewtual" /></View>;
  const CurrentScreen = screens[route.name];
  const isTab = tabs.some(tab => tab.name === route.name);
  const selectedTab = route.name === 'new-goal' || route.name === 'goal-detail' || route.name === 'approvals' ? 'goals' : activeTab;
  return <View style={{ flex: 1, flexDirection: 'row', justifyContent: desktop ? 'flex-start' : 'center', backgroundColor: theme.bg }}>
    <StatusBar style={theme.isDark ? 'light' : 'dark'} />
    {desktop && <View style={{ width: 240, padding: 24, borderRightWidth: 1, borderRightColor: theme.border, backgroundColor: theme.surface }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 36 }}><BrewtualMark /><AppText variant="heading">brewtual</AppText></View>
      <AppText variant="eyebrow" color={theme.muted} style={{ marginBottom: 12 }}>YOUR SHARED ROUTINE</AppText>
      {tabs.map(tab => <Pressable key={tab.name} accessibilityRole="button" accessibilityState={{ selected: selectedTab === tab.name }} onPress={() => navigate({ name: tab.name })} style={({ pressed }) => ({ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 12, backgroundColor: selectedTab === tab.name || pressed ? theme.accentSoft : 'transparent' })}><Icon name={tab.icon} color={selectedTab === tab.name ? theme.accent : theme.muted} /><AppText>{tab.label}</AppText></Pressable>)}
      <View style={{ flex: 1 }} />
      <AppText variant="caption" color={theme.muted} style={{ marginBottom: 16 }}>{mode === 'demo' ? 'Local demo · Alex & Jamie' : `${names.alex} + ${names.jamie}`}</AppText>
      <Pressable accessibilityRole="button" onPress={() => navigate({ name: 'settings' })} style={{ minHeight: 44, flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name="settings" /><AppText>Settings</AppText></Pressable>
    </View>}
    <SafeAreaView edges={route.name === 'new-goal' ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']} style={{ flex: 1, width: '100%', maxWidth: desktop ? 880 : 460, alignSelf: 'stretch', backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, minHeight: 68 }}>
        {isTab ? <Pressable onPress={() => navigate({ name: 'today' })} accessibilityRole="button" accessibilityLabel="brewtual Today" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 }}><BrewtualMark size={26} /><AppText variant="heading" style={{ fontSize: 24 }}>brewtual</AppText></Pressable>
          : <IconButton name="back" label="Go back" onPress={goBack} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <IconButton name="bell" label={`Approvals, ${pendingCount} waiting`} badgeCount={pendingCount} onPress={() => navigate({ name: 'approvals' })} />
          <Pressable onPress={() => navigate({ name: 'settings' })} accessibilityRole="button" accessibilityLabel={`Settings for ${names[person]}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Avatar person={person} /></Pressable>
        </View>
      </View>
      {(themeSaveError || demoSaveError || error) && <View accessibilityRole="alert" style={{ marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.warning }}><AppText variant="caption" color={theme.warning}>{error || 'Saving on this device is unavailable. Your changes may not be kept when you reopen the app.'}</AppText>{error && refresh ? <Button label="Retry loading" variant="ghost" onPress={() => void refresh().catch(() => {})} /> : null}</View>}
      {busy ? <ActivityIndicator color={theme.accent} accessibilityLabel="Saving" /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <CurrentScreen key={`${route.name}:${route.id ?? ''}:${route.goalOwner ?? ''}`} route={route} navigate={navigate} goBack={goBack} />
      </KeyboardAvoidingView>
      {!desktop && route.name !== 'new-goal' && <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg, paddingHorizontal: 10, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 10) }}>
        {tabs.map(tab => {
          const selected = selectedTab === tab.name;
          return <Pressable key={tab.name} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} accessibilityLabel={tab.label} onPress={() => navigate({ name: tab.name })} style={({ pressed }) => ({ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3, opacity: pressed ? .7 : 1 })}>
            <View style={{ position: 'absolute', width: 19, height: 2, backgroundColor: selected ? theme.accent : 'transparent', top: -8, borderRadius: 3 }} />
            <Icon name={tab.icon} size={22} color={selected ? theme.accent : theme.muted} />
            <AppText variant="caption" color={selected ? theme.accent : theme.muted} style={{ fontSize: 10 }}>{tab.label}</AppText>
          </Pressable>;
        })}
      </View>}
    </SafeAreaView>
  </View>;
}

export default function App() {
  return <SafeAreaProvider><ThemeProvider><AuthGate><AppShell /></AuthGate></ThemeProvider></SafeAreaProvider>;
}
