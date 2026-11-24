import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { TrackListSkeleton } from '@/features/catalog/components/catalog-ui';
import { SearchField } from '@/features/catalog/components/search-browse';
import { useLikedTracks } from '@/features/catalog/hooks';
import { usePlayerStore } from '@/features/player/player-store';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Button,
  EmptyState,
  Pill,
  PlayerDock,
  Screen,
  Skeleton,
  Text,
  TrackRow,
  colors,
  fontFamily,
  radii,
  spacing,
} from '@/ui';

type LibraryFilter = 'all' | 'liked' | 'playlists' | 'uploads';

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'liked', label: 'Liked' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'uploads', label: 'Uploads' },
];

export default function LibraryScreen() {
  const { session } = useSession();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const enabled = isSupabaseConfigured && !!session;
  const liked = useLikedTracks(enabled);
  const likedTracks = liked.data ?? [];
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredLiked = normalizedQuery
    ? likedTracks.filter((track) =>
        `${track.title} ${track.artist}`.toLowerCase().includes(normalizedQuery),
      )
    : likedTracks;
  const showLikedList = filter === 'liked' || normalizedQuery.length > 0;
  const songCount = likedTracks.length;

  const toggleSearch = () => {
    setSearching((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  };

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text variant="title">Your Library</Text>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={searching ? 'Close library search' : 'Search library'}
                hitSlop={8}
                onPress={toggleSearch}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons
                  name={searching ? 'close' : 'search'}
                  size={24}
                  color={colors.text}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create playlist"
                hitSlop={8}
                onPress={() =>
                  Alert.alert('Playlists', 'Playlist creation arrives in the next milestone.')
                }
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="add" size={28} color={colors.text} />
              </Pressable>
            </View>
          </View>
          {searching ? (
            <SearchField
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search in Your Library"
              autoFocus
            />
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => (
            <Pill
              key={item.id}
              label={item.label}
              selected={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.body}>
          {!isSupabaseConfigured || !session ? (
            <EmptyState
              title="Sign in to see your library"
              body={
                !isSupabaseConfigured
                  ? 'Supabase is not configured, so your library cannot load.'
                  : 'Like catalog tracks while listening and they will appear here.'
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

          {showLikedList ? (
            <>
              {enabled && liked.isLoading ? <TrackListSkeleton rows={5} /> : null}

              {enabled && !liked.isLoading && liked.error ? (
                <EmptyState
                  title="Couldn't load liked songs"
                  body={
                    liked.error instanceof Error
                      ? liked.error.message
                      : 'Please try again in a moment.'
                  }
                />
              ) : null}

              {enabled &&
              !liked.isLoading &&
              !liked.error &&
              filteredLiked.length === 0 ? (
                <EmptyState
                  title={normalizedQuery ? 'No matches' : 'No liked songs yet'}
                  body={
                    normalizedQuery
                      ? 'Try a different title or artist.'
                      : 'Tap the heart on the player or like tracks you enjoy from the catalog.'
                  }
                />
              ) : null}

              {enabled && !liked.isLoading && !liked.error && filteredLiked.length > 0 ? (
                <View style={styles.trackList}>
                  {filteredLiked.map((track, index) => (
                    <TrackRow
                      key={track.id}
                      title={track.title}
                      artist={track.artist}
                      artworkUrl={track.coverUrl}
                      onPress={() => void playQueue(filteredLiked, index, 'liked')}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {enabled && !showLikedList ? (
            <>
              {liked.isLoading ? (
                <View style={styles.row}>
                  <Skeleton width={56} height={56} radius={0} />
                  <View style={styles.rowText}>
                    <Skeleton width={120} height={14} />
                    <Skeleton width={80} height={12} />
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Liked Songs, ${songCount} songs`}
                  disabled={songCount === 0}
                  onPress={() => void playQueue(likedTracks, 0, 'liked')}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                    songCount === 0 && styles.rowMuted,
                  ]}
                >
                  <LinearGradient
                    colors={['#3E1F6D', '#9B7BE0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.likedTile}
                  >
                    <Ionicons name="heart" size={24} color={colors.text} />
                  </LinearGradient>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Liked Songs</Text>
                    <Text variant="caption" muted>
                      Playlist • {songCount} song{songCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Playlists"
                onPress={() =>
                  Alert.alert('Playlists', 'Playlist creation arrives in the next milestone.')
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.placeholderTile}>
                  <Ionicons name="musical-notes" size={22} color={colors.textMuted} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Playlists</Text>
                  <Text variant="caption" muted>
                    Playlist creation arrives in the next milestone.
                  </Text>
                </View>
                <Ionicons name="add" size={20} color={colors.textMuted} />
              </Pressable>

              {filter !== 'playlists' ? (
                <View style={[styles.row, styles.rowMuted]}>
                  <View style={styles.placeholderTile}>
                    <Ionicons name="cloud-upload-outline" size={22} color={colors.textMuted} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Uploads</Text>
                    <Text variant="caption" muted>
                      Your own tracks live here once uploads ship.
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <PlayerDock />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { paddingHorizontal: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 56,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    overflow: 'hidden',
    paddingRight: spacing.md,
  },
  rowPressed: { backgroundColor: colors.elevated },
  rowMuted: { opacity: 0.7 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.text },
  likedTile: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  placeholderTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevated,
  },
  trackList: { gap: spacing.xs },
  pressed: { opacity: 0.6 },
});
