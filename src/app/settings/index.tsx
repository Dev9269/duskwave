import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';
import { Button, Card, Screen, Text, colors, spacing } from '@/ui';

export default function SettingsScreen() {
  const { profile, session, signOut } = useSession();
  const [seeding, setSeeding] = useState(false);

  const loadDemoHistory = async () => {
    setSeeding(true);
    try {
      const { data, error } = await getSupabase().rpc('seed_demo_history');
      if (error) {
        Alert.alert('Could not load demo history', error.message);
        return;
      }
      Alert.alert(
        'Demo history',
        data && data > 0
          ? `Added ${data} plays across the last fourteen nights, plus a few likes.`
          : 'Nothing to add yet — the catalog is empty or the demo night is already loaded.',
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text variant="title">Settings</Text>
        </View>

        <Card style={styles.section}>
          <Text variant="heading">Account</Text>
          <Text variant="caption" muted>
            {session?.user.email ?? 'Not signed in'}
          </Text>
          <Text variant="caption" muted>
            @{profile?.username ?? 'listener'} · {(profile?.tier ?? 'free').toUpperCase()}
          </Text>
        </Card>

        <Card raised style={styles.section}>
          <Text variant="heading">Demo night</Text>
          <Text variant="caption" muted>
            Loads fourteen evenings of listening history and a handful of liked tracks, once, so
            the history and stats screens have something to show.
          </Text>
          <Button
            label="Load demo history"
            variant="secondary"
            loading={seeding}
            onPress={() => void loadDemoHistory()}
          />
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open licenses and attributions"
          onPress={() => router.push('/licenses')}
          style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}
        >
          <Card style={styles.linkRow}>
            <View style={styles.linkIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.linkText}>
              <Text variant="heading">Licenses & attribution</Text>
              <Text variant="caption" muted>
                Creative Commons licenses and credits for catalog tracks.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Button
          label="Sign out"
          variant="danger"
          fullWidth
          onPress={() => void handleSignOut()}
        />

        <Text variant="caption" muted style={styles.note}>
          Duskwave is an open-source project. Audio in the catalog is CC-licensed; attribution
          travels with every track.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  section: { gap: spacing.sm },
  linkCard: { borderRadius: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  linkText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.9 },
  note: { paddingHorizontal: spacing.xs },
});
