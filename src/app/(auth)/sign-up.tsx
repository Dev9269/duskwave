import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';
import { friendlyAuthError } from '@/features/auth/errors';
import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';
import { Button, Text, TextField, spacing } from '@/ui';

type DateOfBirth = { iso: string } | { error: string };

function parseDateOfBirth(day: string, month: string, year: string): DateOfBirth {
  if (!day.trim() || !month.trim() || !year.trim()) {
    return { error: 'Add your date of birth.' };
  }

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { error: 'That date is not valid.' };
  }

  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { error: 'That date is not valid.' };
  }

  const now = new Date();
  if (date > now) {
    return { error: 'That date is in the future.' };
  }

  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) {
    age -= 1;
  }
  if (age < 13) {
    return { error: 'You need to be at least 13 to sign up.' };
  }

  return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

export default function SignUpScreen() {
  const { configured } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
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
    const dob = parseDateOfBirth(day, month, year);
    if ('error' in dob) {
      setError(dob.error);
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim(),
            date_of_birth: dob.iso,
          },
        },
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
      title="Sign up to listen free"
      subtitle="One account for your library, your history, and the people you listen with."
      footer={
        <Button
          label="I already have an account"
          variant="ghost"
          fullWidth
          onPress={() => router.replace('/(auth)/sign-in')}
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
          label="Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
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
        />

        <View style={styles.dobGroup}>
          <Text variant="label" muted>
            Date of birth
          </Text>
          <View style={styles.dobRow}>
            <TextField
              value={day}
              onChangeText={(value) => setDay(value.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="DD"
              maxLength={2}
              style={styles.dobInput}
              accessibilityLabel="Day of birth"
            />
            <TextField
              value={month}
              onChangeText={(value) => setMonth(value.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="MM"
              maxLength={2}
              style={styles.dobInput}
              accessibilityLabel="Month of birth"
            />
            <TextField
              value={year}
              onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="YYYY"
              maxLength={4}
              style={styles.dobInput}
              accessibilityLabel="Year of birth"
            />
          </View>
        </View>

        {error ? (
          <Text variant="caption" danger>
            {error}
          </Text>
        ) : null}

        <Text variant="caption" muted>
          By signing up you agree to the Duskwave terms and privacy policy.
        </Text>

        <Button
          label="Sign up"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!configured}
          onPress={() => void submit()}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  dobGroup: { gap: spacing.sm },
  dobRow: { flexDirection: 'row', gap: spacing.md },
  dobInput: { textAlign: 'center' },
});
