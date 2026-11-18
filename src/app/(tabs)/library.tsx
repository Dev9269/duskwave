import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSession } from '@/features/auth/session-provider';
import { TrackListSkeleton } from '@/features/catalog/components/catalog-ui';
import { useLikedTracks } from '@/features/catalog/hooks';
import { usePlayerStore } from '@/features/player/player-store';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Button,
  Card,
  EmptyState,
  PlayerDock,
  Screen,
  SectionHeader,
  Text,
  TrackRow,
  colors,
  spacing,
} from '@/ui';

export default function LibraryScreen() {
  const { session } = useSession();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const enabled = isSupabaseConfigured && !!session;
  const liked = useLikedTracks(enabled);
  const likedTracks = liked.data ?? [];

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Your library</Text>
          <Text muted>Songs you keep, playlists you build, and the people you blend with.</Text>
        </View>

        <SectionHeader title="Liked songs" caption={`${likedTracks.length} track${likedTracks.length === 1 ? '' : 's'}`} />
        {!isSupabaseConfigured || !session ? (
          <EmptyState
            title="Sign in to see liked songs"
            body={
              !isSupabaseConfigured
                ? 'Supabase is not configured, so your library cannot load.'
                : 'Like catalog tracks while listening and they will appear here.'
            }
            action={
              !session ? (
                <Button label="Sign in" variant="secondary" onPress={() => router.replace('/(auth)/welcome')} />
              ) : undefined
            }
          />
        ) : null}

        {enabled && liked.isLoading ? <TrackListSkeleton rows={5} /> : null}

        {enabled && !liked.isLoading && liked.error ? (
          <EmptyState
            title="Couldn't load liked songs"
            body={liked.error instanceof Error ? liked.error.message : 'Please try again in a moment.'}
          />
        ) : null}

        {enabled && !liked.isLoading && !liked.error && likedTracks.length === 0 ? (
          <EmptyState
            title="No liked songs yet"
            body="Tap the heart on the player or like tracks you enjoy from the catalog."
          />
        ) : null}

        {enabled && !liked.isLoading && !liked.error && likedTracks.length > 0 ? (
          <View style={styles.trackList}>
            {likedTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                title={track.title}
                artist={track.artist}
                artworkUrl={track.coverUrl}
                durationMs={track.durationMs}
                onPress={() => void playQueue(likedTracks, index, 'liked')}
              />
            ))}
          </View>
        ) : null}

        <SectionHeader title="Playlists" caption="Coming in M2." />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled>
          <Card style={[styles.row, styles.disabled]}>
            <View style={styles.icon}>
              <Ionicons name="albums" size={20} color={colors.textFaint} />
            </View>
            <View style={styles.rowText}>
              <Text variant="heading" muted>
                Playlists
              </Text>
              <Text variant="caption" muted>
                Create and manage playlists in the next milestone.
              </Text>
            </View>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textFaint} />
          </Card>
        </Pressable>

        <SectionHeader title="Uploads" caption="Your own tracks live here once uploads ship." />
        <Card raised style={styles.placeholder}>
          <Text variant="heading">Nothing uploaded</Text>
          <Text variant="caption" muted>
            Free accounts get three uploads. Premium unlocks more, plus offline and crossfade.
          </Text>
        </Card>
      </ScrollView>
      <PlayerDock />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  trackList: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  disabled: { opacity: 0.7 },
  placeholder: { gap: spacing.sm },
});
