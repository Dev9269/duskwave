import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { MoodShelfCards, TrackShelf } from '@/features/catalog/components/catalog-ui';
import { useFreshTracks, useMoodShelf, useRecentlyPlayed } from '@/features/catalog/hooks';
import { usePlayerStore } from '@/features/player/player-store';
import { greeting } from '@/lib/greeting';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button, EmptyState, PlayerBar, Screen, SectionHeader, Text, spacing } from '@/ui';

const HOME_MOOD = 'chill';

export default function HomeScreen() {
  const { profile, session } = useSession();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const firstName = profile?.display_name?.split(' ')[0] || 'listener';
  const enabled = isSupabaseConfigured && !!session;

  const recentlyPlayed = useRecentlyPlayed(12);
  const freshTracks = useFreshTracks(12);
  const moodShelf = useMoodShelf(HOME_MOOD, 10);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="caption" accent style={styles.brand}>
            DUSKWAVE
          </Text>
          <Text variant="display">
            {greeting()}, {firstName}
          </Text>
          <Text muted>The room is open. Your night, in sound.</Text>
        </View>

        {!isSupabaseConfigured || !session ? (
          <EmptyState
            title="Catalog shelves unavailable"
            body={
              !isSupabaseConfigured
                ? 'Supabase is not configured, so catalog shelves cannot load.'
                : 'Sign in to see your recent listening and fresh catalog picks.'
            }
            action={
              !session ? (
                <Button label="Sign in" variant="secondary" onPress={() => router.replace('/(auth)/welcome')} />
              ) : undefined
            }
          />
        ) : null}

        {enabled ? (
          <>
            <TrackShelf
              title="Recently played"
              caption="Your latest catalog listens."
              tracks={recentlyPlayed.data}
              loading={recentlyPlayed.isLoading}
              error={recentlyPlayed.error}
              emptyTitle="No listening history yet"
              emptyBody="Play something from Search to start building your recent shelf."
              context="history"
            />

            <TrackShelf
              title="Fresh in the catalog"
              caption="New playable tracks from the licensed catalog."
              tracks={freshTracks.data}
              loading={freshTracks.isLoading}
              error={freshTracks.error}
              emptyTitle="Catalog is warming up"
              emptyBody="Fresh tracks will appear here once catalog records are seeded."
              context="search"
            />

            <View style={styles.section}>
              <SectionHeader
                title={`${HOME_MOOD[0].toUpperCase()}${HOME_MOOD.slice(1)} mood shelf`}
                caption="A mood-picked slice of the catalog."
              />
              <MoodShelfCards
                tracks={moodShelf.data}
                loading={moodShelf.isLoading}
                error={moodShelf.error}
                onPlay={(tracks, index) => void playQueue(tracks, index, 'search')}
              />
            </View>
          </>
        ) : null}

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
    gap: spacing.xl,
  },
  header: { gap: spacing.md },
  brand: { letterSpacing: 4 },
  section: { gap: spacing.sm },
  playerWrap: { marginTop: spacing.lg },
});
