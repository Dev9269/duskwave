import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  EmptyState,
  Pill,
  SectionHeader,
  Skeleton,
  Text,
  colors,
  fontFamily,
  radii,
  spacing,
} from '@/ui';
import type { Track } from '@/features/catalog/api';
import { usePlayerStore } from '@/features/player/player-store';
import type { PlayContext } from '@/types/database';

import { TrackListSkeleton } from './track-list-skeleton';
export { TrackListSkeleton };

const CARD_WIDTH = 144;

export function ShelfSkeleton() {
  return (
    <View style={styles.shelfRow}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.cardSkeleton}>
          <Skeleton width={CARD_WIDTH} height={CARD_WIDTH} radius={radii.sm} />
          <Skeleton width={112} height={14} />
          <Skeleton width={80} height={12} />
        </View>
      ))}
    </View>
  );
}

export function ShelfCards({
  tracks,
  onPlay,
}: {
  tracks: Track[];
  onPlay: (tracks: Track[], index: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelfRow}
    >
      {tracks.map((track, index) => (
        <Pressable
          key={track.id}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
          onPress={() => onPlay(tracks, index)}
          style={({ pressed }) => [styles.shelfCard, pressed && styles.pressed]}
        >
          {track.coverUrl ? (
            <Image source={{ uri: track.coverUrl }} style={styles.shelfArt} contentFit="cover" />
          ) : (
            <View style={[styles.shelfArt, styles.shelfArtPlaceholder]}>
              <Text variant="caption" muted>
                No artwork
              </Text>
            </View>
          )}
          <Text style={styles.cardTitle} numberOfLines={1}>
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
      {loading ? <ShelfSkeleton /> : null}
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
        <ShelfCards tracks={tracks} onPlay={(items, index) => void playQueue(items, index, context)} />
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

  return <ShelfCards tracks={tracks} onPlay={onPlay} />;
}

export function RecentlyPlayedGrid({
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
  if (loading) {
    return (
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <View key={item} style={styles.gridItem}>
            <Skeleton width="100%" height={56} radius={radii.sm} />
          </View>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn't load recent listening"
        body={error instanceof Error ? error.message : 'Please try again in a moment.'}
      />
    );
  }

  const items = tracks?.slice(0, 6) ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.grid}>
      {items.map((track, index) => (
        <Pressable
          key={track.id}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
          onPress={() => onPlay(items, index)}
          style={({ pressed }) => [styles.gridItem, pressed && styles.gridItemPressed]}
        >
          {track.coverUrl ? (
            <Image source={{ uri: track.coverUrl }} style={styles.gridArt} contentFit="cover" />
          ) : (
            <View style={[styles.gridArt, styles.shelfArtPlaceholder]}>
              <Text variant="caption" muted>
                No artwork
              </Text>
            </View>
          )}
          <Text variant="label" numberOfLines={1} style={styles.gridTitle}>
            {track.title}
          </Text>
        </Pressable>
      ))}
    </View>
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
  shelfRow: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.xs },
  cardSkeleton: { width: CARD_WIDTH, gap: spacing.sm },
  shelfCard: { width: CARD_WIDTH, gap: spacing.xs },
  shelfArt: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  shelfArtPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.75 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  gridItem: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  gridItemPressed: { backgroundColor: colors.elevated },
  gridArt: {
    width: 56,
    height: 56,
    backgroundColor: colors.elevated,
  },
  gridTitle: { flex: 1, paddingRight: spacing.sm },
  filterGroup: { gap: spacing.sm },
  pillRow: { gap: spacing.sm, paddingVertical: 2 },
});
