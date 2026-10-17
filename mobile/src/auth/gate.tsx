import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, Icon, PlantArt } from '../components';
import { useTheme } from '../theme';
import { Account, AuthError, loadAccount, refreshSession, signIn, signOut } from './client';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { theme, ready } = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const passwordInput = useRef<TextInput>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    refreshSession().then(user => { if (active) setAccount(user); }).catch(reason => {
      if (active && !(reason instanceof AuthError && reason.status === 401)) setError(reason instanceof Error ? reason.message : 'Unable to restore sign-in.');
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!account) return;
    const timer = setInterval(() => {
      if (!pending.current) void run(async () => { setAccount(await refreshSession()); });
    }, 14 * 60 * 1000);
    return () => clearInterval(timer);
  }, [account?.id]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (reason) {
      if (reason instanceof AuthError && reason.status === 401) setAccount(null);
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.');
    } finally { pending.current = false; setBusy(false); }
  }

  if (!ready || checking) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}><ActivityIndicator accessibilityLabel="Restoring sign-in" color={theme.accent} /></View>;
  if (demo) return <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: theme.surface2 }}>
      <AppText variant="caption">Fictional demo · saved on this device</AppText>
      <Button label={account ? 'Back to account' : 'Back to sign in'} variant="ghost" onPress={() => setDemo(false)} />
    </SafeAreaView>{children}
  </View>;

  const inputStyle = { minHeight: 50, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, color: theme.text, backgroundColor: theme.surface2, fontSize: 16, marginTop: 6, marginBottom: 16 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 480 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}><Icon name="leaf" color={theme.accent} /><AppText variant="heading">pair habits.</AppText></View>
          <PlantArt size={100} />
          <AppText variant="heading" style={{ marginTop: 16, marginBottom: 8 }}>{account ? 'Your space, together.' : 'A little better, together.'}</AppText>
          <AppText color={theme.muted} style={{ marginBottom: 24 }}>{account ? 'You’re securely signed in to Pair Habits.' : 'Sign in with your individual account to access your shared space.'}</AppText>
          {error ? <AppText accessibilityRole="alert" color={theme.danger} style={{ marginBottom: 16 }}>{error}</AppText> : null}
          {account ? <Card>
            <AppText variant="eyebrow" color={theme.accent}>SIGNED IN</AppText>
            <AppText style={{ marginVertical: 12 }}>{account.email}</AppText>
            <AppText color={theme.muted} style={{ marginBottom: 16 }}>Your account is connected. Goals, rewards and activity are still available as a separate fictional demo while we connect those screens to the API.</AppText>
            <Button label={busy ? 'Please wait…' : 'Check account connection'} disabled={busy} onPress={() => void run(async () => { setAccount(await loadAccount()); })} variant="secondary" />
            <Button label="Sign out" disabled={busy} style={{ marginTop: 10 }} onPress={() => void run(async () => { await signOut(); setAccount(null); setPassword(''); })} />
          </Card> : <Card>
            <AppText accessibilityLabel="Email label">Email</AppText>
            <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} style={inputStyle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><AppText>Password</AppText><Button label={visible ? 'Hide password' : 'Show password'} variant="ghost" onPress={() => setVisible(value => !value)} /></View>
            <TextInput ref={passwordInput} accessibilityLabel="Password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" maxLength={128} onSubmitEditing={() => { if (email.trim() && password) void run(async () => { setAccount(await signIn(email, password)); setPassword(''); }); }} style={inputStyle} />
            <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || !email.trim() || !password} onPress={() => void run(async () => { setAccount(await signIn(email, password)); setPassword(''); })} />
            <AppText variant="caption" color={theme.muted} style={{ marginTop: 16 }}>Private accounts are set up by your app administrator. Contact them if you need access or a password reset.</AppText>
          </Card>}
          <Button label="Explore the fictional demo" variant="ghost" disabled={busy} onPress={() => { setPassword(''); setError(''); setDemo(true); }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
