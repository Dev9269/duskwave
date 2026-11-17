import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';
import { signInWithProvider } from '@/features/auth/oauth';
import { Button, spacing } from '@/ui';

export default function WelcomeScreen() {
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    const result = await signInWithProvider('google');
    setBusy(false);
    if (result.error) {
      Alert.alert('Sign-in failed', result.error);
    }
  };

  return (
    <AuthScreen
      title="Night sounds, shared."
      subtitle="A listening room for the hours after dark. Licensed music, your playlists, friends in sync."
      footer={
        <Button
          label="Continue with Google"
          variant="ghost"
          fullWidth
          loading={busy}
          onPress={() => void google()}
        />
      }
    >
      <View style={styles.actions}>
        <Button
          label="Create account"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/sign-up')}
        />
        <Button
          label="I already have an account"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
});
