import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import {
  MoodShelfCards,
  RecentlyPlayedGrid,
  TrackShelf,
} from '@/features/catalog/components/catalog-ui';
import {
  useFreshTracks,
  useMoodShelf,
  useRecentlyPlayed,
  useRecommendedTracks,
} from '@/features/catalog/hooks';
import { usePlayerStore } from '@/features/player/player-store';
import { greeting } from '@/lib/greeting';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Button,
  EmptyState,
  Pill,
  PlayerDock,
  Screen,
  SectionHeader,
  Text,
  colors,
  fontFamily,
  spacing,
} from '@/ui';

const HOME_MOOD = 'chill';
type HomeShelf = 'all' | 'fresh' | 'moods';

export default function HomeScreen() {
  const { profile, session } = useSession();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const enabled = isSupabaseConfigured && !!session;
  const [shelf, setShelf] = useState<HomeShelf>('all');

  const recentlyPlayed = useRecentlyPlayed(12);
  const freshTracks = useFreshTracks(12);
  const moodShelf = useMoodShelf(HOME_MOOD, 10);
  const recommendations = useRecommendedTracks(12, enabled);

  const displayName = profile?.display_name?.trim() || profile?.username || 'listener';
  const initial = displayName.charAt(0).toUpperCase();
  const recentTracks = recentlyPlayed.data ?? [];
  const showRecent =
    shelf === 'all' &&
    (recentlyPlayed.isLoading || !!recentlyPlayed.error || recentTracks.length > 0);
  const showMood =
    moodShelf.isLoading || !!moodShelf.error || (moodShelf.data?.length ?? 0) > 0;

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarInitial]}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={10}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Text variant="title">{greeting()}</Text>

          <View style={styles.chips}>
            <Pill label="All" selected={shelf === 'all'} onPress={() => setShelf('all')} />
            <Pill label="Fresh" selected={shelf === 'fresh'} onPress={() => setShelf('fresh')} />
            <Pill label="Moods" selected={shelf === 'moods'} onPress={() => setShelf('moods')} />
          </View>
        </View>

        {!enabled ? (
          <EmptyState
            title="Catalog shelves unavailable"
            body={
              !isSupabaseConfigured
                ? 'Supabase is not configured, so catalog shelves cannot load.'
                : 'Sign in to see your recent listening and fresh catalog picks.'
            }
            action={
              !session ? (
                <Button
                  label="Sign in"
                  variant="secondary"
                  onPress={() => router.replace('/(auth)/welcome')}
                />
              ) : undefined
            }
          />
        ) : null}

        {enabled && showRecent ? (
          <View style={styles.section}>
            <SectionHeader title="Recently played" />
            <RecentlyPlayedGrid
              tracks={recentTracks}
              loading={recentlyPlayed.isLoading}
              error={recentlyPlayed.error}
              onPlay={(tracks, index) => void playQueue(tracks, index, 'history')}
            />
          </View>
        ) : null}

        {enabled && shelf === 'all' ? (
          <TrackShelf
            title="Made for you"
            caption="Picks shaped by your likes"
            tracks={recommendations.data}
            loading={recommendations.isLoading}
            error={recommendations.error}
            emptyTitle="Like a few tracks first"
            emptyBody="Your recommendations appear once you have liked or played some music."
            context="search"
          />
        ) : null}

        {enabled && (shelf === 'all' || shelf === 'fresh') ? (
          <TrackShelf
            title="Fresh in the catalog"
            tracks={freshTracks.data}
            loading={freshTracks.isLoading}
            error={freshTracks.error}
            emptyTitle="Catalog is warming up"
            emptyBody="Fresh tracks will appear here once catalog records are seeded."
            context="search"
          />
        ) : null}

        {enabled && shelf !== 'fresh' && showMood ? (
          <View style={styles.section}>
            <SectionHeader title="Chill" />
            <MoodShelfCards
              tracks={moodShelf.data}
              loading={moodShelf.isLoading}
              error={moodShelf.error}
              onPlay={(tracks, index) => void playQueue(tracks, index, 'search')}
            />
          </View>
        ) : null}

        {enabled && shelf === 'moods' && !showMood ? (
          <EmptyState
            title="No mood picks yet"
            body="Catalog tracks tagged for this mood will appear here."
          />
        ) : null}
      </ScrollView>
      <PlayerDock />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: { gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised },
  avatarInitial: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.bodyBold, fontSize: 14, color: colors.text },
  section: { gap: spacing.sm },
  pressed: { opacity: 0.7 },
});
