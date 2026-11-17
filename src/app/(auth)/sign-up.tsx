import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';
import { friendlyAuthError } from '@/features/auth/errors';
import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';
import { Button, Text, TextField, spacing } from '@/ui';

export default function SignUpScreen() {
  const { configured } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: displayName.trim() } },
      });
      if (authError) {
        setError(friendlyAuthError(authError.message));
        return;
      }
      if (data.session) {
        router.replace('/(auth)/onboarding');
        return;
      }
      Alert.alert(
        'Confirm your email',
        'We sent you a confirmation link. Open it, then come back and sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Make a room of your own"
      subtitle="One account for your library, your history, and the friends you listen with."
    >
      {!configured ? (
        <Text variant="caption" danger>
          Supabase is not configured. Copy .env.example to .env.local and restart the dev server.
        </Text>
      ) : null}
      <View style={styles.form}>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          textContentType="name"
          placeholder="What should we call you?"
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 8 characters"
          hint="At least 8 characters."
          error={error}
        />
        <Button
          label="Create account"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!configured}
          onPress={() => void submit()}
        />
      </View>
      <Button
        label="I already have an account"
        variant="ghost"
        fullWidth
        onPress={() => router.replace('/(auth)/sign-in')}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
