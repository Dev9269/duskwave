import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Screen, Text, colors, spacing } from '@/ui';

type State =
  | { kind: 'checking' }
  | { kind: 'success' }
  | { kind: 'error'; title: string; detail: string };

export default function SpotifyRedirectScreen() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const [status, setStatus] = useState<State>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (params.error) {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            title: 'Spotify declined the connection',
            detail: String(params.error),
          });
        }
        return;
      }

      if (!params.code) {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            title: 'That link was incomplete',
            detail: 'missing_code — Spotify did not send an authorization code.',
          });
        }
        return;
      }

      const expected = await SecureStore.getItemAsync('spotify_oauth_state');
      if (!params.state || (expected !== null && expected !== params.state)) {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            title: 'That link did not match this session',
            detail: 'state_mismatch — start the import again from Duskwave.',
          });
        }
        return;
      }

      if (!cancelled) {
        setStatus({ kind: 'success' });
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, params.state]);

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons
            name={status.kind === 'error' ? 'alert-circle' : 'checkmark'}
            size={40}
            color={status.kind === 'error' ? colors.danger : colors.accent}
          />
        </View>

        {status.kind === 'checking' ? (
          <Text variant="title">Checking the handoff...</Text>
        ) : status.kind === 'success' ? (
          <>
            <Text variant="title">Spotify is connected</Text>
            <Text muted style={styles.detail}>
              The playlist picker and matching preview arrive with the importer milestone. This
              handoff is wired and waiting for it.
            </Text>
          </>
        ) : (
          <>
            <Text variant="title">{status.title}</Text>
            <Text muted style={styles.detail}>
              {status.detail}
            </Text>
          </>
        )}

        <Button
          label="Back to Duskwave"
          variant="secondary"
          onPress={() => router.replace('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  detail: { textAlign: 'center' },
});
