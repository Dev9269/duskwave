/* eslint-disable import/first */
jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is not configured for this test.');
  },
}));

import {
  DEFAULT_SEARCH_FILTERS,
  SEARCH_BPM_RANGES,
  buildSearchParams,
  getBpmRange,
  hasSearchIntent,
  selectBpmRange,
  toggleChipValue,
} from '@/features/catalog/components/search-ui';

describe('search-ui helpers', () => {
  it('toggles chip values on/off', () => {
    expect(toggleChipValue(null, 'folk')).toBe('folk');
    expect(toggleChipValue('folk', 'folk')).toBeNull();
    expect(toggleChipValue('folk', 'jazz')).toBe('jazz');
  });

  it('selects bpm range and resets to any on reselect', () => {
    expect(selectBpmRange('any', 'mid')).toBe('mid');
    expect(selectBpmRange('mid', 'mid')).toBe('any');
    expect(selectBpmRange('fast', 'slow')).toBe('slow');
  });

  it('resolves bpm range definitions with fallback', () => {
    expect(getBpmRange('mid')).toMatchObject({ bpmMin: 90, bpmMax: 120 });
    expect(getBpmRange('unknown')).toEqual(SEARCH_BPM_RANGES[0]);
  });

  it('builds search params from query and filters', () => {
    expect(buildSearchParams('  rain  ', { ...DEFAULT_SEARCH_FILTERS, mood: 'chill' }, 30)).toEqual({
      query: 'rain',
      genre: null,
      mood: 'chill',
      bpmMin: null,
      bpmMax: null,
      limit: 30,
      offset: 0,
    });

    expect(buildSearchParams('', { genre: 'jazz', mood: null, bpmRangeId: 'fast' })).toEqual({
      query: null,
      genre: 'jazz',
      mood: null,
      bpmMin: 121,
      bpmMax: null,
      limit: 30,
      offset: 0,
    });
  });

  it('detects search intent from query or filters', () => {
    expect(hasSearchIntent('', DEFAULT_SEARCH_FILTERS)).toBe(false);
    expect(hasSearchIntent('   ', DEFAULT_SEARCH_FILTERS)).toBe(false);
    expect(hasSearchIntent('rain', DEFAULT_SEARCH_FILTERS)).toBe(true);
    expect(hasSearchIntent('', { ...DEFAULT_SEARCH_FILTERS, genre: 'folk' })).toBe(true);
    expect(hasSearchIntent('', { ...DEFAULT_SEARCH_FILTERS, bpmRangeId: 'slow' })).toBe(true);
  });
});