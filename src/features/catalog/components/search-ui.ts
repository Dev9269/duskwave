import { clampLimit, normalizeText, type SearchTracksParams } from '../api';

export const SEARCH_GENRES = ['ambient', 'electronic', 'folk', 'jazz', 'pop', 'rock'] as const;
export const SEARCH_MOODS = ['calm', 'chill', 'energetic', 'focus', 'melancholy', 'uplifting'] as const;

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
