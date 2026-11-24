import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import {
  Pill,
  PlayerDock,
  Screen,
  Text,
  colors,
  fontFamily,
  radii,
  spacing,
} from '@/ui';

export default function ProfileScreen() {
  const { profile, session } = useSession();
  const initial = (profile?.display_name || profile?.username || 'D').slice(0, 1).toUpperCase();

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerSide, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.identity}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarInitial]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <Text variant="title">{profile?.display_name || 'Listener'}</Text>
          <Text muted>@{profile?.username ?? 'listener'}</Text>
          <Pill
            label={(profile?.tier ?? 'free').toUpperCase()}
            selected={profile?.tier === 'premium'}
          />
          <Text variant="caption" muted style={styles.bio}>
            {profile?.bio || 'No bio yet. Your Blend card will show this alongside your top genres.'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>

          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowText} numberOfLines={1}>
              {session?.user.email ?? 'Not signed in'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowText}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
      <PlayerDock />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 16, color: colors.text },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.sm,
  },
  avatarInitial: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.bodyBold, fontSize: 36, color: colors.text },
  bio: { textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 56,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
  },
  rowPressed: { backgroundColor: colors.elevated },
  rowText: { flex: 1, fontFamily: fontFamily.body, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.6 },
});
