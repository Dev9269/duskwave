import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';

import { setSessionFromUrl } from '@/features/auth/oauth';
import { Button, Screen, Text, colors, spacing } from '@/ui';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    void setSessionFromUrl(url).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else {
        router.replace('/');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Screen>
      <View style={styles.body}>
        {error ? (
          <>
            <Text variant="title">That link did not work.</Text>
            <Text muted>{error}</Text>
            <Button label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text muted>Finishing sign-in...</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});
