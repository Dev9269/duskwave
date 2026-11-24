import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Provider } from '@supabase/supabase-js';

import { Button, colors, spacing } from '@/ui';

import { signInWithProvider } from './oauth';

type SocialProvider = Extract<Provider, 'google' | 'apple'>;

type SocialButtonsProps = {
  disabled?: boolean;
};

export function SocialButtons({ disabled }: SocialButtonsProps) {
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const run = async (provider: SocialProvider) => {
    setBusy(provider);
    try {
      const result = await signInWithProvider(provider);
      if (result.error) {
        Alert.alert('Sign-in failed', result.error);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.stack}>
      <Button
        label="Continue with Google"
        variant="secondary"
        size="lg"
        fullWidth
        disabled={disabled || busy !== null}
        loading={busy === 'google'}
        icon={<Ionicons name="logo-google" size={18} color={colors.text} />}
        onPress={() => void run('google')}
      />
      <Button
        label="Continue with Apple"
        variant="secondary"
        size="lg"
        fullWidth
        disabled={disabled || busy !== null}
        loading={busy === 'apple'}
        icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
        onPress={() => void run('apple')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
