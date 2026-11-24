import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import {
  getAlbumDetail,
  getGenreDetail,
  getPlaylistDetail,
} from '../detail-api';

jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is not configured for this test.');
  },
}));

type Row = Record<string, unknown>;

function fakeClient(tables: Record<string, Row[]>): SupabaseClient<Database> {
  const from = (table: string) => {
    const filters: { column: string; value: unknown; kind: 'eq' | 'in' }[] = [];

    const matches = () => {
      let rows = tables[table] ?? [];
      for (const filter of filters) {
        rows = rows.filter((row) =>
          filter.kind === 'eq'
            ? row[filter.column] === filter.value
            : Array.isArray(filter.value) && filter.value.includes(row[filter.column]),
        );
      }
      return rows;
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push({ column, value, kind: 'eq' });
        return builder;
      },
      in: (column: string, value: unknown[]) => {
        filters.push({ column, value, kind: 'in' });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve({ data: matches(), error: null }).then(resolve, reject),
    };

    return builder;
  };

  return { from } as unknown as SupabaseClient<Database>;
}

const artist = { id: 'artist-1', name: 'Nova Vale', image_url: null, bio: null };
const album = {
  id: 'album-1',
  artist_id: 'artist-1',
  title: 'Night Drive',
  cover_url: null,
  release_year: 2026,
  license: null,
  license_url: null,
};
const playlist = {
  id: 'playlist-1',
  owner_id: 'user-1',
  title: 'Late Drive',
  description: 'Night picks',
  cover_url: null,
  kind: 'user',
  visibility: 'private',
  pair_key: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function trackRow(id: string, overrides: Row = {}): Row {
  return {
    id,
    slug: id,
    title: `Track ${id}`,
    artist_id: 'artist-1',
    album_id: 'album-1',
    duration_ms: 180_000,
    audio_key: `catalog/${id}.mp3`,
    cover_url: null,
    isrc: null,
    genre: 'ambient',
    mood: 'chill',
    bpm: 90,
    source: 'catalog',
    owner_id: null,
    is_playable: true,
    license: null,
    license_url: null,
    attribution: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getAlbumDetail', () => {
  it('returns the album, artist name, and playable album tracks', async () => {
    const client = fakeClient({
      albums: [album],
      artists: [artist],
      tracks: [trackRow('a'), trackRow('b', { is_playable: false })],
    });

    const detail = await getAlbumDetail(client, 'album-1');

    expect(detail?.title).toBe('Night Drive');
    expect(detail?.artistName).toBe('Nova Vale');
    expect(detail?.tracks.map((track) => track.id)).toEqual(['a']);
  });
});

describe('getGenreDetail', () => {
  it('returns only playable tracks for the requested genre', async () => {
    const client = fakeClient({
      artists: [artist],
      albums: [album],
      tracks: [
        trackRow('a', { genre: 'jazz' }),
        trackRow('b', { genre: 'ambient' }),
        trackRow('c', { genre: 'jazz', is_playable: false }),
      ],
    });

    const detail = await getGenreDetail(client, 'jazz', 10);

    expect(detail.tracks.map((track) => track.id)).toEqual(['a']);
  });
});

describe('getPlaylistDetail', () => {
  it('returns playlist tracks ordered by position', async () => {
    const client = fakeClient({
      playlists: [playlist],
      playlist_tracks: [
        { id: 'pt-1', playlist_id: 'playlist-1', track_id: 'b', position: 2 },
        { id: 'pt-2', playlist_id: 'playlist-1', track_id: 'a', position: 1 },
      ],
      artists: [artist],
      albums: [album],
      tracks: [trackRow('a'), trackRow('b')],
    });

    const detail = await getPlaylistDetail(client, 'playlist-1');

    expect(detail?.title).toBe('Late Drive');
    expect(detail?.tracks.map((track) => track.id)).toEqual(['a', 'b']);
  });
});
