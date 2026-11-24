import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';
import { friendlyAuthError } from '@/features/auth/errors';
import { authCallbackUrl } from '@/features/auth/oauth';
import { SocialButtons } from '@/features/auth/social-buttons';
import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';
import { Button, Text, TextField, colors, spacing } from '@/ui';

export default function SignInScreen() {
  const { configured } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordless, setPasswordless] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (!passwordless && !password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      if (passwordless) {
        const { error: authError } = await getSupabase().auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: authCallbackUrl() },
        });
        if (authError) {
          setError(friendlyAuthError(authError.message));
          return;
        }
        Alert.alert(
          'Check your email',
          `We sent a login link to ${email.trim()}. Open it on this device to finish signing in.`,
        );
        return;
      }

      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(friendlyAuthError(authError.message));
        return;
      }
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Log in to Duskwave"
      subtitle="The room is warm. Pick up where the night left off."
      footer={
        <Button
          label="New here? Sign up free"
          variant="ghost"
          fullWidth
          onPress={() => router.replace('/(auth)/sign-up')}
        />
      }
    >
      {!configured ? (
        <Text variant="caption" danger>
          Supabase is not configured. Copy .env.example to .env.local and restart the dev server.
        </Text>
      ) : null}

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        {passwordless ? (
          <Text variant="caption" muted>
            No password needed. We will email you a one-time login link.
          </Text>
        ) : (
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="Your password"
            error={error}
          />
        )}
        {passwordless && error ? (
          <Text variant="caption" danger>
            {error}
          </Text>
        ) : null}
        <Button
          label={passwordless ? 'Email me a login link' : 'Log in'}
          size="lg"
          fullWidth
          loading={busy}
          disabled={!configured}
          onPress={() => void submit()}
        />
        <Button
          label={passwordless ? 'Use a password instead' : 'Log in without a password'}
          variant="ghost"
          fullWidth
          onPress={() => {
            setPasswordless((value) => !value);
            setError(null);
          }}
        />
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text variant="caption" muted>
          or
        </Text>
        <View style={styles.line} />
      </View>

      <SocialButtons disabled={!configured} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
});
