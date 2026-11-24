import { clampLimit, normalizeText, type SearchTracksParams } from '../api';

export const SEARCH_GENRES = ['ambient', 'electronic', 'folk', 'jazz', 'pop', 'rock'] as const;
export const SEARCH_MOODS = ['calm', 'chill', 'energetic', 'focus', 'melancholy', 'uplifting'] as const;

export type BrowseCategory = {
  id: string;
  label: string;
  color: string;
  icon: 'musical-notes' | 'pulse' | 'flash' | 'cafe' | 'leaf' | 'cloudy' | 'moon' | 'headset';
  genre?: string;
  mood?: string;
};

export const BROWSE_CATEGORIES: readonly BrowseCategory[] = [
  { id: 'pop', label: 'Pop', color: '#8D67AB', icon: 'musical-notes', genre: 'pop' },
  { id: 'electronic', label: 'Electronic', color: '#DC148C', icon: 'pulse', genre: 'electronic' },
  { id: 'rock', label: 'Rock', color: '#E91429', icon: 'flash', genre: 'rock' },
  { id: 'jazz', label: 'Jazz', color: '#1E3264', icon: 'moon', genre: 'jazz' },
  { id: 'folk', label: 'Folk', color: '#608108', icon: 'leaf', genre: 'folk' },
  { id: 'ambient', label: 'Ambient', color: '#0D72EA', icon: 'cloudy', genre: 'ambient' },
  { id: 'chill', label: 'Chill', color: '#D84000', icon: 'cafe', mood: 'chill' },
  { id: 'focus', label: 'Focus', color: '#503750', icon: 'headset', mood: 'focus' },
];

export type BpmRange = {
  id: string;
  label: string;
  bpmMin: number | null;
  bpmMax: number | null;
};

export const SEARCH_BPM_RANGES: readonly BpmRange[] = [
  { id: 'any', label: 'Any BPM', bpmMin: null, bpmMax: null },
  { id: 'slow', label: 'Slow <90', bpmMin: null, bpmMax: 89 },
  { id: 'mid', label: '90-120', bpmMin: 90, bpmMax: 120 },
  { id: 'fast', label: '120+', bpmMin: 121, bpmMax: null },
];

export type SearchFilterState = {
  genre: string | null;
  mood: string | null;
  bpmRangeId: string;
};

export const DEFAULT_SEARCH_FILTERS: SearchFilterState = {
  genre: null,
  mood: null,
  bpmRangeId: 'any',
};

export type SearchSource = 'all' | 'catalog' | 'audius';

export const DEFAULT_SEARCH_SOURCE: SearchSource = 'all';

export const SEARCH_SOURCES: readonly { id: SearchSource; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'catalog', label: 'Duskwave' },
  { id: 'audius', label: 'Audius' },
];

export function isFilterActive(filters: SearchFilterState): boolean {
  return filters.genre !== null || filters.mood !== null || filters.bpmRangeId !== 'any';
}

export function toggleChipValue(current: string | null, value: string): string | null {
  return current === value ? null : value;
}

export function selectBpmRange(currentId: string, nextId: string): string {
  return currentId === nextId ? 'any' : nextId;
}

export function getBpmRange(id: string): BpmRange {
  return SEARCH_BPM_RANGES.find((range) => range.id === id) ?? SEARCH_BPM_RANGES[0];
}

export function buildSearchParams(
  query: string,
  filters: SearchFilterState,
  limit = 30,
): SearchTracksParams {
  const range = getBpmRange(filters.bpmRangeId);
  return {
    query: normalizeText(query),
    genre: filters.genre,
    mood: filters.mood,
    bpmMin: range.bpmMin,
    bpmMax: range.bpmMax,
    limit: clampLimit(limit, 30),
    offset: 0,
  };
}

export function hasSearchIntent(query: string, filters: SearchFilterState): boolean {
  return (
    normalizeText(query) !== null ||
    filters.genre !== null ||
    filters.mood !== null ||
    filters.bpmRangeId !== 'any'
  );
}
