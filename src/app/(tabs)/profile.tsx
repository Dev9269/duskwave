import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';
import { Card, Pill, PlayerBar, Screen, Text, colors, spacing } from '@/ui';

export default function ProfileScreen() {
  const { profile, session } = useSession();
  const initial = (profile?.display_name || profile?.username || 'D').slice(0, 1).toUpperCase();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text variant="display">{initial}</Text>
          </View>
          <Text variant="title">{profile?.display_name || 'Listener'}</Text>
          <Text muted>@{profile?.username ?? 'listener'}</Text>
          <Pill label={(profile?.tier ?? 'free').toUpperCase()} selected={profile?.tier === 'premium'} />
        </View>

        <Card style={styles.row}>
          <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowText} numberOfLines={1}>
            {session?.user.email ?? 'Not signed in'}
          </Text>
        </Card>

        <Text variant="caption" muted style={styles.note}>
          {profile?.bio || 'No bio yet. Your Blend card will show this alongside your top genres.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
        >
          <Card style={styles.row}>
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowText}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>
        </Pressable>
        <View style={styles.playerWrap}>
          <PlayerBar />
        </View>
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
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1 },
  note: { paddingHorizontal: spacing.xs },
  settingsRow: { borderRadius: 12 },
  pressed: { opacity: 0.9 },
  playerWrap: { marginTop: spacing.md },
});
