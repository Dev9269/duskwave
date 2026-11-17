import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState, Pill, SectionHeader, Skeleton, Text, TrackRow, colors, radii, spacing } from '@/ui';
import type { Track } from '@/features/catalog/api';
import { usePlayerStore } from '@/features/player/player-store';
import type { PlayContext } from '@/types/database';

import { TrackListSkeleton } from './track-list-skeleton';
export { TrackListSkeleton };

export function ShelfSkeleton() {
  return (
    <View style={styles.shelfSkeleton}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.cardSkeleton}>
          <Skeleton width="100%" height={120} radius={12} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="55%" height={12} />
        </View>
      ))}
    </View>
  );
}

export function TrackShelf({
  title,
  caption,
  tracks,
  loading,
  error,
  emptyTitle,
  emptyBody,
  context,
}: {
  title: string;
  caption?: string;
  tracks: Track[] | undefined;
  loading: boolean;
  error: unknown;
  emptyTitle: string;
  emptyBody?: string;
  context: PlayContext;
}) {
  const playQueue = usePlayerStore((s) => s.playQueue);

  return (
    <View style={styles.section}>
      <SectionHeader title={title} caption={caption} />
      {loading ? <TrackListSkeleton rows={3} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Couldn't load this shelf"
          body={error instanceof Error ? error.message : 'Please try again in a moment.'}
        />
      ) : null}
      {!loading && !error && (tracks?.length ?? 0) === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : null}
      {!loading && !error && tracks && tracks.length > 0 ? (
        <View style={styles.trackList}>
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              title={track.title}
              artist={track.artist}
              artworkUrl={track.coverUrl}
              durationMs={track.durationMs}
              onPress={() => void playQueue(tracks, index, context)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MoodShelfCards({
  tracks,
  loading,
  error,
  onPlay,
}: {
  tracks: Track[] | undefined;
  loading: boolean;
  error: unknown;
  onPlay: (tracks: Track[], index: number) => void;
}) {
  if (loading) return <ShelfSkeleton />;
  if (error) {
    return (
      <EmptyState
        title="Mood shelf unavailable"
        body={error instanceof Error ? error.message : 'Please try again in a moment.'}
      />
    );
  }
  if (!tracks || tracks.length === 0) {
    return (
      <EmptyState
        title="No mood picks yet"
        body="Catalog tracks tagged for this mood will appear here."
      />
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.moodRow}
    >
      {tracks.map((track, index) => (
        <Pressable
          key={track.id}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
          onPress={() => onPlay(tracks, index)}
          style={({ pressed }) => [styles.moodCard, pressed && styles.pressed]}
        >
          <View style={styles.moodArt}>
            <Text variant="label" accent numberOfLines={1}>
              {track.mood ?? 'Mood'}
            </Text>
          </View>
          <Text variant="bodyMedium" numberOfLines={1}>
            {track.title}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {track.artist}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function FilterPills({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text variant="label" muted>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {options.map((option) => (
          <Pill
            key={option}
            label={option}
            selected={selected === option}
            onPress={() => onSelect(option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  trackList: { gap: spacing.xs },
  shelfSkeleton: { flexDirection: 'row', gap: spacing.md },
  cardSkeleton: { width: 140, gap: spacing.sm },
  moodRow: { gap: spacing.md, paddingVertical: spacing.xs },
  moodCard: {
    width: 150,
    gap: spacing.xs,
  },
  moodArt: {
    height: 110,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
  filterGroup: { gap: spacing.sm },
  pillRow: { gap: spacing.sm, paddingVertical: 2 },
});
