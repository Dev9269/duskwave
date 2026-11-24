import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Track } from '@/features/catalog/api';
import { usePlayerStore } from '@/features/player/player-store';
import type { PlayContext } from '@/types/database';
import {
  Button,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  TrackRow,
  colors,
  radii,
  spacing,
} from '@/ui';

type DetailViewProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  tracks: Track[] | undefined;
  loading: boolean;
  error: unknown;
  emptyTitle: string;
  emptyBody?: string;
  context: PlayContext;
  extra?: ReactNode;
  headerLink?: { label: string; onPress: () => void };
};

function shuffleTracks(tracks: Track[]): Track[] {
  const shuffled = [...tracks];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function DetailView({
  eyebrow,
  title,
  subtitle,
  coverUrl,
  tracks,
  loading,
  error,
  emptyTitle,
  emptyBody,
  context,
  extra,
  headerLink,
}: DetailViewProps) {
  const playQueue = usePlayerStore((state) => state.playQueue);
  const items = tracks ?? [];

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient colors={['#2A3A2F', '#121212']} style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.heroBody}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Ionicons name="musical-notes" size={52} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.heroMeta}>
              <Text variant="caption" accent style={styles.eyebrow}>
                {eyebrow}
              </Text>
              <Text variant="display" style={styles.title} numberOfLines={3}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="caption" muted numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {headerLink ? (
                <Pressable onPress={headerLink.onPress} hitSlop={6} style={styles.headerLink}>
                  <Text variant="label" accent>
                    {headerLink.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.actions}>
          <Button
            label="Play"
            size="lg"
            disabled={items.length === 0}
            onPress={() => void playQueue(items, 0, context)}
          />
          <Button
            label="Shuffle"
            variant="secondary"
            size="lg"
            disabled={items.length === 0}
            onPress={() => void playQueue(shuffleTracks(items), 0, context)}
          />
        </View>

        {extra}

        <View style={styles.trackSection}>
          <SectionHeader title="Songs" caption={`${items.length} tracks`} />
          {loading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} width="100%" height={48} radius={radii.sm} />
              ))}
            </View>
          ) : null}
          {!loading && error ? (
            <EmptyState
              title="Couldn't load these songs"
              body={error instanceof Error ? error.message : 'Please try again in a moment.'}
            />
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <EmptyState title={emptyTitle} body={emptyBody} />
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <View style={styles.trackList}>
              {items.map((track, index) => (
                <TrackRow
                  key={`${track.id}-${index}`}
                  title={track.title}
                  artist={track.artist}
                  artworkUrl={track.coverUrl}
                  durationMs={track.durationMs}
                  onPress={() => void playQueue(items, index, context)}
                  trailing={
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  heroTop: { flexDirection: 'row' },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroBody: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg, marginTop: spacing.lg },
  cover: { width: 132, height: 132, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroMeta: { flex: 1, gap: spacing.xs },
  eyebrow: { letterSpacing: 1.2 },
  title: { fontSize: 28, lineHeight: 34 },
  headerLink: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  trackSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm },
  skeletonList: { gap: spacing.sm },
  trackList: { gap: spacing.xs },
  pressed: { opacity: 0.7 },
});
