import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, getSupabase } from '@/lib/supabase';

import {
  DEFAULT_SHELF_LIMIT,
  clampLimit,
  getFreshTracks,
  getLikedTracks,
  getMoodShelf,
  getRecentlyPlayed,
  hasActiveSearch,
  normalizeSearchParams,
  normalizeText,
  searchTracks,
  type SearchTracksParams,
} from './api';
import { AUDIUS_MIN_QUERY_LENGTH, searchAudiusTracks } from './audius';
import {
  getAlbumDetail,
  getArtistDetail,
  getGenreDetail,
  getPlaylistDetail,
} from './detail-api';
import { getRecommendedTracks } from './recommendation-api';

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
  liked: () => [...catalogKeys.all, 'liked'] as const,
  album: (id: string) => [...catalogKeys.all, 'album', id] as const,
  artist: (id: string) => [...catalogKeys.all, 'artist', id] as const,
  playlist: (id: string) => [...catalogKeys.all, 'playlist', id] as const,
  genre: (name: string) =>
    [...catalogKeys.all, 'genre', normalizeText(name)?.toLowerCase() ?? ''] as const,
  recommended: (limit: number | null = DEFAULT_SHELF_LIMIT) =>
    [...catalogKeys.all, 'recommended', clampLimit(limit)] as const,
  audiusSearch: (query: string) => ['search', 'audius', query] as const,
};

export type SearchHookOptions = { enabled?: boolean };

export function useSearchTracks(
  params: SearchTracksParams = {},
  options: SearchHookOptions = {},
) {
  const normalized = normalizeSearchParams(params);
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: catalogKeys.search(normalized),
    queryFn: () => searchTracks(normalized),
    enabled: enabled && hasActiveSearch(normalized),
    staleTime: SEARCH_STALE_TIME,
    gcTime: 5 * 60_000,
  });
}

export function useAudiusSearch(query: string, options: SearchHookOptions = {}) {
  const trimmed = normalizeText(query) ?? '';
  const enabled = (options.enabled ?? true) && trimmed.length >= AUDIUS_MIN_QUERY_LENGTH;
  return useQuery({
    queryKey: catalogKeys.audiusSearch(trimmed),
    queryFn: () => searchAudiusTracks(trimmed),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: 5 * 60_000,
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

export function useLikedTracks(enabled = true) {
  return useQuery({
    queryKey: catalogKeys.liked(),
    queryFn: () => getLikedTracks(),
    enabled,
    staleTime: SHELF_STALE_TIME,
  });
}

export function useAlbumDetail(id: string) {
  return useQuery({
    queryKey: catalogKeys.album(id),
    queryFn: () => getAlbumDetail(getSupabase(), id),
    enabled: isSupabaseConfigured && id.length > 0,
    staleTime: SHELF_STALE_TIME,
  });
}

export function useArtistDetail(id: string) {
  return useQuery({
    queryKey: catalogKeys.artist(id),
    queryFn: () => getArtistDetail(getSupabase(), id),
    enabled: isSupabaseConfigured && id.length > 0,
    staleTime: SHELF_STALE_TIME,
  });
}

export function usePlaylistDetail(id: string) {
  return useQuery({
    queryKey: catalogKeys.playlist(id),
    queryFn: () => getPlaylistDetail(getSupabase(), id),
    enabled: isSupabaseConfigured && id.length > 0,
    staleTime: SHELF_STALE_TIME,
  });
}

export function useGenreDetail(name: string) {
  return useQuery({
    queryKey: catalogKeys.genre(name),
    queryFn: () => getGenreDetail(getSupabase(), name, 50),
    enabled: isSupabaseConfigured && normalizeText(name) !== null,
    staleTime: SHELF_STALE_TIME,
  });
}

export function useRecommendedTracks(
  limit: number | null = DEFAULT_SHELF_LIMIT,
  enabled = true,
) {
  const pageSize = clampLimit(limit);
  return useQuery({
    queryKey: catalogKeys.recommended(pageSize),
    queryFn: () => getRecommendedTracks(pageSize),
    enabled: enabled && isSupabaseConfigured,
    staleTime: SHELF_STALE_TIME,
  });
}
