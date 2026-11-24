/* eslint-disable import/first */
jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is not configured for this test.');
  },
}));

import type { Track } from '@/features/catalog/api';
import {
  AUDIUS_MIN_QUERY_LENGTH,
  buildAudiusStreamUrl,
  mapAudiusTrack,
  mergeSearchResults,
  searchAudiusTracks,
  type AudiusTrack,
} from '@/features/catalog/audius';

function rawTrack(overrides: Partial<AudiusTrack> = {}): AudiusTrack {
  return {
    id: 'YmJWK',
    title: 'Golden Hour',
    duration: 180.5,
    is_streamable: true,
    is_stream_gated: false,
    is_available: true,
    is_delete: false,
    access: { stream: true },
    artwork: { '150x150': 'https://img/art-150.jpg' },
    user: {
      name: 'Audius Artist',
      handle: 'audius-artist',
      profile_picture: { '150x150': 'https://img/profile-150.jpg' },
    },
    genre: '  ',
    mood: 'chill',
    bpm: 120,
    isrc: 'US1234567890',
    release_date: '2024-01-01',
    ...overrides,
  };
}

function localTrack(id = 'local-1', title = 'Golden Hour', artist = 'Audius Artist'): Track {
  return {
    id,
    slug: id,
    title,
    artist,
    album: null,
    genre: null,
    mood: null,
    bpm: null,
    durationMs: 180_000,
    coverUrl: null,
    license: 'CC BY',
    licenseUrl: null,
    attribution: null,
    source: 'catalog',
    isPlayable: true,
    audioUrl: null,
    audioKey: `catalog/${id}.mp3`,
    isrc: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
});

describe('Audius mapping', () => {
  it('maps a streamable track into the Duskwave Track shape', () => {
    const track = mapAudiusTrack(rawTrack());

    expect(track).toMatchObject({
      id: 'audius:YmJWK',
      slug: 'audius-YmJWK',
      title: 'Golden Hour',
      artist: 'Audius Artist',
      album: null,
      genre: null,
      mood: 'chill',
      bpm: 120,
      durationMs: 180_500,
      coverUrl: 'https://img/art-150.jpg',
      license: null,
      licenseUrl: null,
      attribution: 'Streamed via Audius',
      source: 'audius',
      isPlayable: true,
      isrc: 'US1234567890',
      createdAt: '2024-01-01',
    });
    expect(track?.audioUrl).toBe(buildAudiusStreamUrl('YmJWK'));
    expect(track?.audioKey).toBe(buildAudiusStreamUrl('YmJWK'));
  });

  it('rejects tracks that cannot be streamed', () => {
    expect(mapAudiusTrack(rawTrack({ is_streamable: false }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ access: { stream: false } }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ is_stream_gated: true }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ is_available: false }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ is_delete: true }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ duration: 0 }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ title: '   ' }))).toBeNull();
  });

  it('rejects non-music or too-short Audius content', () => {
    expect(mapAudiusTrack(rawTrack({ genre: 'Podcasts' }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ genre: 'Audiobooks' }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ tags: 'chill,podcast,news' }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ tags: 'interview,artist' }))).toBeNull();
    expect(mapAudiusTrack(rawTrack({ duration: 29 }))).toBeNull();
  });

  it('uses safe fallbacks for incomplete records', () => {
    const track = mapAudiusTrack(
      rawTrack({
        artwork: undefined,
        user: { profile_picture: 'https://img/profile.jpg' },
        release_date: ' ',
        created_at: ' ',
        genre: ' ',
        bpm: Number.NaN,
      }),
    );

    expect(track?.artist).toBe('Unknown artist');
    expect(track?.coverUrl).toBe('https://img/profile.jpg');
    expect(track?.createdAt).toBe(new Date(0).toISOString());
    expect(track?.genre).toBeNull();
    expect(track?.bpm).toBeNull();
  });
});

describe('Audius search', () => {
  it('fetches, filters, and maps playable results', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          rawTrack(),
          rawTrack({ id: 'blocked', is_streamable: false }),
          rawTrack({ id: 'podcast', genre: 'Podcasts' }),
        ],
      }),
    });

    const results = await searchAudiusTracks('  Golden Hour  ');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/tracks/search?'),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(fetchMock.mock.calls[0][0]).toContain('query=Golden%20Hour');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('audius:YmJWK');
  });

  it('does not request the API below the minimum query length', async () => {
    await expect(searchAudiusTracks('a')).resolves.toEqual([]);
    await expect(searchAudiusTracks('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(AUDIUS_MIN_QUERY_LENGTH).toBe(2);
  });

  it('throws a useful error for a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await expect(searchAudiusTracks('Golden Hour')).rejects.toThrow(
      'Audius search failed (503).',
    );
  });
});

describe('Audius merge', () => {
  it('keeps local order and drops duplicate Audius tracks', () => {
    const local = [localTrack('local-1', 'Golden  Hour', 'Audius Artist')];
    const audius = [
      localTrack('audius:1', 'golden hour', ' audius artist '),
      localTrack('audius:2', 'Another Song', 'Another Artist'),
      localTrack('audius:3', 'ANOTHER SONG', 'another artist'),
    ];

    expect(mergeSearchResults(local, audius)).toEqual([local[0], audius[1]]);
  });

  it('does not mutate either input', () => {
    const local = [localTrack()];
    const audius = [localTrack('audius:1', 'Different', 'Different')];
    const localBefore = [...local];
    const audiusBefore = [...audius];

    mergeSearchResults(local, audius);

    expect(local).toEqual(localBefore);
    expect(audius).toEqual(audiusBefore);
  });
});
