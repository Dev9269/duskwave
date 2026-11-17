import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';
import { friendlyAuthError } from '@/features/auth/errors';
import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';
import { Button, Text, TextField, spacing } from '@/ui';

export default function SignInScreen() {
  const { configured } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    try {
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
    <AuthScreen title="Welcome back" subtitle="The room is warm. Pick up where the night left off.">
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
        <Button label="Sign in" size="lg" fullWidth loading={busy} disabled={!configured} onPress={() => void submit()} />
      </View>
      <Button
        label="New here? Create an account"
        variant="ghost"
        fullWidth
        onPress={() => router.replace('/(auth)/sign-up')}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
