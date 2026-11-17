import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SHELF_LIMIT,
  buildSearchTracksArgs,
  clampLimit,
  clampOffset,
  hasActiveSearch,
  normalizeSearchParams,
} from '@/features/catalog/api';
import { catalogKeys } from '@/features/catalog/hooks';

jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is not configured for this test.');
  },
}));

describe('normalizeSearchParams', () => {
  it('trims text filters and treats blank strings as absent', () => {
    expect(
      normalizeSearchParams({ query: '  rain  ', genre: ' Folk ', mood: '   ' }),
    ).toMatchObject({
      query: 'rain',
      genre: 'Folk',
      mood: null,
    });
  });

  it('applies search defaults for an empty param object', () => {
    expect(normalizeSearchParams({})).toEqual({
      query: null,
      genre: null,
      mood: null,
      bpmMin: null,
      bpmMax: null,
      limit: DEFAULT_SEARCH_LIMIT,
      offset: 0,
    });
  });

  it('passes bpm bounds through unchanged', () => {
    const normalized = normalizeSearchParams({ bpmMin: 90, bpmMax: 130 });
    expect(normalized.bpmMin).toBe(90);
    expect(normalized.bpmMax).toBe(130);
  });

  it('clamps limit to 1..100 and offset to >= 0', () => {
    expect(normalizeSearchParams({ limit: 0 })).toMatchObject({ limit: 1 });
    expect(normalizeSearchParams({ limit: 250 })).toMatchObject({ limit: 100 });
    expect(normalizeSearchParams({ limit: 10, offset: 5 })).toMatchObject({
      limit: 10,
      offset: 5,
    });
    expect(normalizeSearchParams({ offset: -4 })).toMatchObject({ offset: 0 });
  });
});

describe('clampLimit / clampOffset', () => {
  it('clamps shelf limits into range and falls back when absent', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(1000)).toBe(100);
    expect(clampLimit(null)).toBe(DEFAULT_SHELF_LIMIT);
    expect(clampLimit(undefined)).toBe(DEFAULT_SHELF_LIMIT);
    expect(clampLimit(12)).toBe(12);
  });

  it('clamps offsets to >= 0', () => {
    expect(clampOffset(-3)).toBe(0);
    expect(clampOffset(null)).toBe(0);
    expect(clampOffset(7)).toBe(7);
  });
});

describe('buildSearchTracksArgs', () => {
  it('maps app params to RPC argument names', () => {
    expect(
      buildSearchTracksArgs({
        query: ' rain ',
        genre: 'Folk',
        mood: '',
        bpmMin: 90,
        bpmMax: 130,
        limit: 20,
        offset: 5,
      }),
    ).toEqual({
      q: 'rain',
      genre: 'Folk',
      mood: null,
      bpm_min: 90,
      bpm_max: 130,
      lim: 20,
      off: 5,
    });
  });

  it('clamps limit and offset in RPC args', () => {
    const args = buildSearchTracksArgs({ limit: 0, offset: -1 });
    expect(args.lim).toBe(1);
    expect(args.off).toBe(0);
    expect(args.q).toBeNull();
  });
});

describe('hasActiveSearch', () => {
  it('is false without a query or filter', () => {
    expect(hasActiveSearch({})).toBe(false);
    expect(hasActiveSearch({ query: '   ', genre: '', mood: '  ' })).toBe(false);
    expect(hasActiveSearch({ limit: 20, offset: 10 })).toBe(false);
  });

  it('is true for a query or any active filter', () => {
    expect(hasActiveSearch({ query: 'rain' })).toBe(true);
    expect(hasActiveSearch({ genre: 'Folk' })).toBe(true);
    expect(hasActiveSearch({ mood: 'Chill' })).toBe(true);
    expect(hasActiveSearch({ bpmMin: 0 })).toBe(true);
    expect(hasActiveSearch({ bpmMax: 120 })).toBe(true);
  });
});

describe('catalogKeys', () => {
  it('builds stable search keys regardless of whitespace and property order', () => {
    expect(catalogKeys.search({ query: '  rain ', limit: 20 })).toEqual(
      catalogKeys.search({ limit: 20, query: 'rain' }),
    );
  });

  it('keeps different filters in distinct keys', () => {
    expect(catalogKeys.search({ query: 'rain' })).not.toEqual(
      catalogKeys.search({ query: 'rain', mood: 'Chill' }),
    );
  });

  it('namespaces every catalog query under the catalog prefix', () => {
    expect(catalogKeys.search({})[0]).toBe('catalog');
    expect(catalogKeys.recentlyPlayed(10)[0]).toBe('catalog');
    expect(catalogKeys.fresh(10)[0]).toBe('catalog');
    expect(catalogKeys.moodShelf('Chill', 10)[0]).toBe('catalog');
  });

  it('normalizes shelf keys with clamped limits and trimmed lowercase moods', () => {
    expect(catalogKeys.fresh(1000)).toEqual(catalogKeys.fresh(100));
    expect(catalogKeys.recentlyPlayed()).toEqual(catalogKeys.recentlyPlayed(DEFAULT_SHELF_LIMIT));
    expect(catalogKeys.moodShelf('  Chill ', 10)).toEqual(catalogKeys.moodShelf('chill', 10));
  });

  it('distinguishes mood shelves with different moods', () => {
    expect(catalogKeys.moodShelf('Chill', 10)).not.toEqual(
      catalogKeys.moodShelf('Energetic', 10),
    );
  });
});
