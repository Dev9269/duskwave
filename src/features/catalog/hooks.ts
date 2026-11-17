import { useQuery } from '@tanstack/react-query';

import {
  DEFAULT_SHELF_LIMIT,
  clampLimit,
  getFreshTracks,
  getMoodShelf,
  getRecentlyPlayed,
  hasActiveSearch,
  normalizeSearchParams,
  normalizeText,
  searchTracks,
  type SearchTracksParams,
} from './api';

const SEARCH_STALE_TIME = 60_000;
const SHELF_STALE_TIME = 5 * 60_000;

export const catalogKeys = {
  all: ['catalog'] as const,
  search: (params: SearchTracksParams = {}) =>
    [...catalogKeys.all, 'search', normalizeSearchParams(params)] as const,
  recentlyPlayed: (limit: number | null = DEFAULT_SHELF_LIMIT) =>
    [...catalogKeys.all, 'recently-played', clampLimit(limit)] as const,
  fresh: (limit: number | null = DEFAULT_SHELF_LIMIT) =>
    [...catalogKeys.all, 'fresh', clampLimit(limit)] as const,
  moodShelf: (mood: string, limit: number | null = DEFAULT_SHELF_LIMIT) =>
    [...catalogKeys.all, 'mood', normalizeText(mood)?.toLowerCase() ?? '', clampLimit(limit)] as const,
};

export function useSearchTracks(params: SearchTracksParams = {}) {
  const normalized = normalizeSearchParams(params);
  return useQuery({
    queryKey: catalogKeys.search(normalized),
    queryFn: () => searchTracks(normalized),
    enabled: hasActiveSearch(normalized),
    staleTime: SEARCH_STALE_TIME,
  });
}

export function useRecentlyPlayed(limit: number | null = DEFAULT_SHELF_LIMIT) {
  const pageSize = clampLimit(limit);
  return useQuery({
    queryKey: catalogKeys.recentlyPlayed(pageSize),
    queryFn: () => getRecentlyPlayed(pageSize),
    staleTime: SHELF_STALE_TIME,
  });
}

export function useFreshTracks(limit: number | null = DEFAULT_SHELF_LIMIT) {
  const pageSize = clampLimit(limit);
  return useQuery({
    queryKey: catalogKeys.fresh(pageSize),
    queryFn: () => getFreshTracks(pageSize),
    staleTime: SHELF_STALE_TIME,
  });
}

export function useMoodShelf(mood: string, limit: number | null = DEFAULT_SHELF_LIMIT) {
  const pageSize = clampLimit(limit);
  return useQuery({
    queryKey: catalogKeys.moodShelf(mood, pageSize),
    queryFn: () => getMoodShelf(mood, pageSize),
    enabled: normalizeText(mood) !== null,
    staleTime: SHELF_STALE_TIME,
  });
}
