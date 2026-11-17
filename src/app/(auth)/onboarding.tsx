import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { suggestUsername, validateUsername } from '@/features/auth/username';
import { getSupabase } from '@/lib/supabase';
import { Button, Text, TextField, spacing } from '@/ui';

export default function OnboardingScreen() {
  const { session, profile, refreshProfile, signOut } = useSession();
  const [username, setUsername] = useState(() =>
    suggestUsername(session?.user.email ?? profile?.display_name ?? ''),
  );
  const [displayName, setDisplayName] = useState(
    () => profile?.display_name || String(session?.user.user_metadata.full_name ?? ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const submit = async () => {
    const normalized = username.trim().toLowerCase();
    const issue = validateUsername(normalized);
    if (issue) {
      setError(issue);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const { error: updateError } = await getSupabase()
        .from('profiles')
        .update({
          username: normalized,
          display_name: displayName.trim() || normalized,
          onboarding: { completed: true },
        })
        .eq('id', session.user.id);

      if (updateError) {
        setError(
          updateError.code === '23505'
            ? 'That username is taken. Try another one.'
            : updateError.message,
        );
        return;
      }

      await refreshProfile();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Pick your handle"
      subtitle="This is how friends find you for Blends and Jams."
      footer={
        <Button
          label="Use a different account"
          variant="ghost"
          fullWidth
          onPress={() => void signOut()}
        />
      }
    >
      <View style={styles.form}>
        <TextField
          label="Username"
          value={username}
          onChangeText={(value) => setUsername(value.toLowerCase())}
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          placeholder="night_owl"
          hint="3-20 lowercase letters, numbers, or underscores."
          error={error}
        />
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          textContentType="name"
          placeholder="Your name"
        />
        <Button
          label="Enter Duskwave"
          size="lg"
          fullWidth
          loading={busy}
          onPress={() => void submit()}
        />
      </View>
      <Text variant="caption" muted>
        Your listening history stays private unless you share a Blend or join a Jam.
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
