import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { hasActiveSearch } from '@/features/catalog/api';
import {
  DEFAULT_SEARCH_FILTERS,
  SEARCH_BPM_RANGES,
  SEARCH_GENRES,
  SEARCH_MOODS,
  buildSearchParams,
  hasSearchIntent,
  selectBpmRange,
  toggleChipValue,
  type SearchFilterState,
} from '@/features/catalog/components/search-ui';
import { FilterPills, TrackListSkeleton } from '@/features/catalog/components/catalog-ui';
import { useSearchTracks } from '@/features/catalog/hooks';
import { usePlayerStore } from '@/features/player/player-store';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { isSupabaseConfigured } from '@/lib/supabase';
import { EmptyState, Pill, PlayerBar, Screen, Text, TextField, TrackRow, spacing } from '@/ui';

export default function SearchScreen() {
  const { session } = useSession();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilterState>(DEFAULT_SEARCH_FILTERS);
  const debouncedQuery = useDebouncedValue(query, 300);

  const searchParams = useMemo(
    () => buildSearchParams(debouncedQuery, filters),
    [debouncedQuery, filters],
  );
  const intent = useMemo(() => hasSearchIntent(query, filters), [query, filters]);
  const activeSearch = hasActiveSearch(searchParams);
  const search = useSearchTracks(searchParams);
  const debouncing = query !== debouncedQuery;

  const showLoading = activeSearch && (debouncing || search.isLoading || search.isFetching);
  const showPreSearch = !intent && !activeSearch;
  const showEmpty =
    activeSearch &&
    !showLoading &&
    !search.error &&
    (search.data?.length ?? 0) === 0;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Search</Text>
          <Text muted>Tracks, moods, and BPM from the Duskwave catalog.</Text>
        </View>

        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Try 'slow burn', 'rainy', or an artist"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          hint="Search uses the catalog only."
        />

        <FilterPills
          label="Genre"
          options={SEARCH_GENRES}
          selected={filters.genre}
          onSelect={(value) =>
            setFilters((prev) => ({ ...prev, genre: toggleChipValue(prev.genre, value) }))
          }
        />

        <FilterPills
          label="Mood"
          options={SEARCH_MOODS}
          selected={filters.mood}
          onSelect={(value) =>
            setFilters((prev) => ({ ...prev, mood: toggleChipValue(prev.mood, value) }))
          }
        />

        <View style={styles.filterGroup}>
          <Text variant="label" muted>
            BPM
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {SEARCH_BPM_RANGES.map((range) => (
              <Pill
                key={range.id}
                label={range.label}
                selected={filters.bpmRangeId === range.id}
                onPress={() =>
                  setFilters((prev) => ({
                    ...prev,
                    bpmRangeId: selectBpmRange(prev.bpmRangeId, range.id),
                  }))
                }
              />
            ))}
          </ScrollView>
        </View>

        {!isSupabaseConfigured || !session ? (
          <EmptyState
            title="Catalog unavailable"
            body={
              !isSupabaseConfigured
                ? 'Supabase is not configured, so catalog search cannot load.'
                : 'Sign in to search the catalog.'
            }
          />
        ) : null}

        {showPreSearch && isSupabaseConfigured && session ? (
          <EmptyState
            title="Find something to play"
            body="Start typing or pick a genre, mood, or BPM range. Results come from licensed catalog tracks."
          />
        ) : null}

        {showLoading ? (
          <View style={styles.results}>
            <Text variant="label" muted>
              Searching catalog…
            </Text>
            <TrackListSkeleton rows={6} />
          </View>
        ) : null}

        {!showLoading && search.error ? (
          <EmptyState
            title="Search failed"
            body={search.error instanceof Error ? search.error.message : 'Please try again in a moment.'}
          />
        ) : null}

        {showEmpty ? (
          <EmptyState
            title="No catalog tracks found"
            body="Try a different query or clear a filter. Only playable catalog tracks appear here."
          />
        ) : null}

        {!showLoading && !search.error && (search.data?.length ?? 0) > 0 ? (
          <View style={styles.results}>
            <Text variant="label" muted>
              {search.data?.length} result{search.data?.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.trackList}>
              {search.data?.map((track, index) => (
                <TrackRow
                  key={track.id}
                  title={track.title}
                  artist={track.artist}
                  artworkUrl={track.coverUrl}
                  durationMs={track.durationMs}
                  onPress={() => void playQueue(search.data ?? [], index, 'search')}
                />
              ))}
            </View>
          </View>
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
  header: { gap: spacing.sm },
  filterGroup: { gap: spacing.sm },
  pillRow: { gap: spacing.sm, paddingVertical: 2 },
  results: { gap: spacing.md },
  trackList: { gap: spacing.xs },
  playerWrap: { marginTop: spacing.md },
});
