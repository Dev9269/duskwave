import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import { hasActiveSearch, normalizeText } from '@/features/catalog/api';
import {
  AUDIUS_MIN_QUERY_LENGTH,
  mergeSearchResults,
} from '@/features/catalog/audius';
import { TrackListSkeleton } from '@/features/catalog/components/catalog-ui';
import {
  BrowseAll,
  SearchField,
  SearchFilterChips,
  SourceFilterChips,
} from '@/features/catalog/components/search-browse';
import {
  DEFAULT_SEARCH_FILTERS,
  DEFAULT_SEARCH_SOURCE,
  buildSearchParams,
  hasSearchIntent,
  isFilterActive,
  type BrowseCategory,
  type SearchFilterState,
  type SearchSource,
} from '@/features/catalog/components/search-ui';
import { useAudiusSearch, useSearchTracks } from '@/features/catalog/hooks';
import { usePlayerStore } from '@/features/player/player-store';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Button,
  EmptyState,
  PlayerDock,
  Screen,
  Text,
  TrackRow,
  colors,
  radii,
  spacing,
} from '@/ui';

export default function SearchScreen() {
  const { session } = useSession();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilterState>(DEFAULT_SEARCH_FILTERS);
  const [source, setSource] = useState<SearchSource>(DEFAULT_SEARCH_SOURCE);
  const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const searchParams = useMemo(
    () => buildSearchParams(debouncedQuery, filters),
    [debouncedQuery, filters],
  );
  const intent = useMemo(() => hasSearchIntent(query, filters), [query, filters]);
  const activeSearch = hasActiveSearch(searchParams);
  const trimmedQuery = normalizeText(debouncedQuery) ?? '';
  const debouncing = query !== debouncedQuery;
  const disabled = !isSupabaseConfigured || !session;
  const localEnabled = !disabled && source !== 'audius';
  const audiusEnabled =
    !disabled && source !== 'catalog' && trimmedQuery.length >= AUDIUS_MIN_QUERY_LENGTH;
  const localQueryActive = localEnabled && activeSearch;

  const search = useSearchTracks(searchParams, { enabled: localEnabled });
  const audius = useAudiusSearch(debouncedQuery, { enabled: audiusEnabled });

  const localResults = localQueryActive ? (search.data ?? []) : [];
  const audiusResults = audiusEnabled ? (audius.data ?? []) : [];
  const results = mergeSearchResults(localResults, audiusResults);

  const localLoading =
    localQueryActive && (debouncing || search.isLoading || search.isFetching);
  const audiusLoading =
    audiusEnabled && (debouncing || audius.isLoading || audius.isFetching);
  const isLoading = localLoading || audiusLoading;
  const localError = localQueryActive ? search.error : null;
  const audiusError = audiusEnabled ? audius.error : null;
  const activeSourceCount = (localQueryActive ? 1 : 0) + (audiusEnabled ? 1 : 0);

  const showLoading = results.length === 0 && isLoading;
  const allActiveFailed =
    activeSourceCount > 0 &&
    !isLoading &&
    (localQueryActive ? !!localError : true) &&
    (audiusEnabled ? !!audiusError : true);
  const hasPartialError = !!(localError || audiusError) && !allActiveFailed;
  const showPreSearch = !intent && source !== 'audius' && !disabled;
  const showBrowse = !disabled && showPreSearch;
  const showAudiusPrompt =
    !disabled && source === 'audius' && trimmedQuery.length === 0;
  const showAudiusShort =
    !disabled &&
    source === 'audius' &&
    trimmedQuery.length > 0 &&
    trimmedQuery.length < AUDIUS_MIN_QUERY_LENGTH;
  const showAllShortCaption =
    !disabled &&
    source === 'all' &&
    trimmedQuery.length > 0 &&
    trimmedQuery.length < AUDIUS_MIN_QUERY_LENGTH;
  const showEmpty =
    !disabled &&
    !showPreSearch &&
    !showAudiusPrompt &&
    !showAudiusShort &&
    !showLoading &&
    !allActiveFailed &&
    activeSourceCount > 0 &&
    results.length === 0;
  const showResults =
    !disabled &&
    !showPreSearch &&
    !showAudiusPrompt &&
    !showAudiusShort &&
    !showLoading &&
    !allActiveFailed &&
    results.length > 0;

  const errorKey = `${source}:${debouncedQuery}`;
  const showPartialError = hasPartialError && dismissedErrorKey !== errorKey;
  const failedSources = [
    localError ? 'Duskwave' : null,
    audiusError ? 'Audius' : null,
  ].filter((value): value is string => value !== null);

  const clearSearch = () => {
    setQuery('');
    setFilters(DEFAULT_SEARCH_FILTERS);
  };

  const retry = () => {
    setDismissedErrorKey(null);
    if (localQueryActive) void search.refetch();
    if (audiusEnabled) void audius.refetch();
  };

  const browseCategory = (category: BrowseCategory) => {
    if (category.genre) {
      router.push({ pathname: '/genre/[name]', params: { name: category.genre } });
      return;
    }

    setQuery('');
    setFilters({
      ...DEFAULT_SEARCH_FILTERS,
      genre: category.genre ?? null,
      mood: category.mood ?? null,
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
          <SearchField value={query} onChangeText={setQuery} onClear={clearSearch} />
        </View>

        <SourceFilterChips source={source} onChange={setSource} />

        {!disabled && !showPreSearch && source !== 'audius' ? (
          <SearchFilterChips filters={filters} onChange={setFilters} />
        ) : null}

        {!disabled && source === 'all' && !showPreSearch && isFilterActive(filters) ? (
          <Text variant="caption" muted style={styles.filterCaption}>
            Filters apply to Duskwave results only.
          </Text>
        ) : null}

        <View style={styles.body}>
          {disabled ? (
            <EmptyState
              title="Catalog unavailable"
              body={
                !isSupabaseConfigured
                  ? 'Supabase is not configured, so catalog search cannot load.'
                  : 'Sign in to search the catalog.'
              }
            />
          ) : null}

          {showAudiusPrompt ? (
            <EmptyState title="Search Audius" body="Search Audius for a song or artist." />
          ) : null}

          {showAudiusShort ? (
            <EmptyState
              title="Keep typing"
              body={`Type at least ${AUDIUS_MIN_QUERY_LENGTH} characters to search Audius.`}
            />
          ) : null}

          {showBrowse ? <BrowseAll onSelect={browseCategory} /> : null}

          {showLoading ? (
            <View style={styles.results}>
              <TrackListSkeleton rows={6} />
            </View>
          ) : null}

          {allActiveFailed ? (
            <EmptyState
              title="Search failed"
              body="Please try again in a moment."
              action={<Button label="Retry" onPress={retry} />}
            />
          ) : null}

          {showPartialError ? (
            <View style={styles.notice}>
              <Text variant="caption" muted style={styles.noticeText}>
                {failedSources.join(' and ')} search failed. Showing available results.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss search error"
                onPress={() => setDismissedErrorKey(errorKey)}
              >
                <Text variant="caption" style={styles.noticeAction}>
                  Dismiss
                </Text>
              </Pressable>
            </View>
          ) : null}

          {showEmpty ? (
            <EmptyState
              title="No tracks found"
              body={
                source === 'catalog'
                  ? 'Try a different query or clear a filter. Only playable Duskwave tracks appear here.'
                  : 'Try a different query or source.'
              }
            />
          ) : null}

          {showResults ? (
            <View style={styles.results}>
              <Text variant="caption" muted style={styles.resultCount}>
                {results.length} result{results.length === 1 ? '' : 's'}
              </Text>
              {showAllShortCaption ? (
                <Text variant="caption" muted>
                  Type at least {AUDIUS_MIN_QUERY_LENGTH} characters to search Audius.
                </Text>
              ) : null}
              {results.length > 0 && audiusLoading && !localLoading ? (
                <Text variant="caption" muted>
                  Searching Audius...
                </Text>
              ) : null}
              {results.length > 0 && localLoading && !audiusLoading ? (
                <Text variant="caption" muted>
                  Searching Duskwave...
                </Text>
              ) : null}
              <View style={styles.trackList}>
                {results.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    title={track.title}
                    artist={track.artist}
                    artworkUrl={track.coverUrl}
                    badge={track.source === 'audius' ? 'Audius' : undefined}
                    onPress={() => void playQueue(results, index, 'search')}
                  />
                ))}
              </View>
            </View>
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
  header: { paddingHorizontal: spacing.lg },
  body: { paddingHorizontal: spacing.lg },
  results: { gap: spacing.sm },
  resultCount: { marginBottom: spacing.xs },
  trackList: { gap: spacing.xs },
  filterCaption: { paddingHorizontal: spacing.lg },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  noticeText: { flex: 1 },
  noticeAction: { textDecorationLine: 'underline' },
});
