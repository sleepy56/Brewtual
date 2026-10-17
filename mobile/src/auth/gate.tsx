import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, Icon, PlantArt } from '../components';
import { useTheme } from '../theme';
import { DemoProvider } from '../demo';
import { LiveProvider } from '../live';
import { Account, AuthError, confirmVerification, refreshSession, resendVerification, signIn, signOut, signup } from './client';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { theme, ready } = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'verify' | 'resend'>('login');
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const passwordInput = useRef<TextInput>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' && window.location.pathname === '/verify-email') {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      setToken(fragment.get('token') ?? ''); setEmail(fragment.get('email') ?? ''); setMode('verify');
      setVerificationRequired(true);
      window.history.replaceState(null, '', '/verify-email');
    }
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
    pending.current = true; setBusy(true); setError(''); setMessage('');
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
    </SafeAreaView><DemoProvider>{children}</DemoProvider>
  </View>;

  async function leaveAccount() {
    try { await signOut(); }
    catch { setError('Signed out on this device, but the server could not confirm session revocation.'); }
    finally { setAccount(null); setPassword(''); setMode('login'); }
  }
  if (account) return <LiveProvider key={account.id} account={account} onSignOut={leaveAccount}>{children}</LiveProvider>;

  const inputStyle = { minHeight: 50, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, color: theme.text, backgroundColor: theme.surface2, fontSize: 16, marginTop: 6, marginBottom: 16 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 480 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}><Icon name="leaf" color={theme.accent} /><AppText variant="heading">pair habits.</AppText></View>
          <PlantArt size={100} />
          <AppText variant="heading" style={{ marginTop: 16, marginBottom: 8 }}>A little better, together.</AppText>
          <AppText color={theme.muted} style={{ marginBottom: 24 }}>{mode === 'verify' ? 'Enter the password you chose at signup to verify your email.' : 'Your own account opens your shared space.'}</AppText>
          {error ? <AppText accessibilityRole="alert" color={theme.danger} style={{ marginBottom: 16 }}>{error}</AppText> : null}
          {message ? <AppText accessibilityRole="alert" color={theme.success} style={{ marginBottom: 16 }}>{message}</AppText> : null}
          <Card>
            <AppText accessibilityLabel="Email label">Email</AppText>
            <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} style={inputStyle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><AppText>Password</AppText><Button label={visible ? 'Hide password' : 'Show password'} variant="ghost" onPress={() => setVisible(value => !value)} /></View>
            {mode !== 'resend' ? <TextInput ref={passwordInput} accessibilityLabel="Password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" maxLength={128} style={inputStyle} /> : null}
            {mode === 'verify' && !token ? <TextInput accessibilityLabel="Verification token" value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Verification token" placeholderTextColor={theme.muted} style={inputStyle} /> : null}
            <Button label={busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'verify' ? 'Verify email' : mode === 'resend' ? 'Resend verification' : 'Sign in'} disabled={busy || !email.trim() || (mode !== 'resend' && !password) || (mode === 'verify' && !token)} onPress={() => void run(async () => {
              if (mode === 'login') { setAccount(await signIn(email, password)); setPassword(''); }
              if (mode === 'signup') { const result = await signup(email, password); setVerificationRequired(result.verificationRequired); setPassword(''); setMode(result.verificationRequired ? 'resend' : 'login'); setMessage(result.message); }
              if (mode === 'resend') { const result = await resendVerification(email); setVerificationRequired(result.verificationRequired); if (!result.verificationRequired) setMode('login'); setMessage(result.message); }
              if (mode === 'verify') { await confirmVerification(email, token, password); setToken(''); setPassword(''); setMode('login'); setMessage('Email verified. Sign in to continue.'); }
            })} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {mode !== 'login' ? <Button label="Sign in" variant="ghost" disabled={busy} onPress={() => { setMode('login'); setPassword(''); setError(''); }} /> : null}
              {mode !== 'signup' ? <Button label="Create account" variant="ghost" disabled={busy} onPress={() => { setMode('signup'); setPassword(''); setError(''); }} /> : null}
              {verificationRequired && mode !== 'resend' ? <Button label="Resend email" variant="ghost" disabled={busy} onPress={() => { setMode('resend'); setPassword(''); setError(''); }} /> : null}
              {verificationRequired && mode !== 'verify' ? <Button label="Enter verification token" variant="ghost" disabled={busy} onPress={() => { setMode('verify'); setPassword(''); setError(''); }} /> : null}
            </View>
          </Card>
          <Button label="Explore the fictional demo" variant="ghost" disabled={busy} onPress={() => { setPassword(''); setError(''); setDemo(true); }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
