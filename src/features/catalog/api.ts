import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
import type {
  Database,
  TrackSource as DatabaseTrackSource,
} from '@/types/database';

export type TrackSource = DatabaseTrackSource | 'audius';

export const DEFAULT_SEARCH_LIMIT = 50;
export const MIN_SEARCH_LIMIT = 1;
export const MAX_SEARCH_LIMIT = 100;
export const DEFAULT_SHELF_LIMIT = 20;

export type Track = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  mood: string | null;
  bpm: number | null;
  durationMs: number;
  coverUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  attribution: string | null;
  source: TrackSource;
  isPlayable: boolean;
  audioUrl: string | null;
  audioKey: string;
  isrc: string | null;
  createdAt: string;
};

export type SearchTracksParams = {
  query?: string | null;
  genre?: string | null;
  mood?: string | null;
  bpmMin?: number | null;
  bpmMax?: number | null;
  limit?: number | null;
  offset?: number | null;
};

export type NormalizedSearchTracksParams = {
  query: string | null;
  genre: string | null;
  mood: string | null;
  bpmMin: number | null;
  bpmMax: number | null;
  limit: number;
  offset: number;
};

export type SearchTracksArgs = {
  q: string | null;
  genre: string | null;
  mood: string | null;
  bpm_min: number | null;
  bpm_max: number | null;
  lim: number;
  off: number;
};

type TrackRow = Database['public']['Tables']['tracks']['Row'];
type ArtistClient = SupabaseClient<Database>;

type AlbumInfo = {
  title: string;
  coverUrl: string | null;
};

export function clampLimit(
  value: number | null | undefined,
  fallback: number = DEFAULT_SHELF_LIMIT,
): number {
  const candidate =
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(Math.max(candidate, MIN_SEARCH_LIMIT), MAX_SEARCH_LIMIT);
}

export function clampOffset(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeBpm(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export function normalizeSearchParams(
  params: SearchTracksParams = {},
): NormalizedSearchTracksParams {
  return {
    query: normalizeText(params.query),
    genre: normalizeText(params.genre),
    mood: normalizeText(params.mood),
    bpmMin: normalizeBpm(params.bpmMin),
    bpmMax: normalizeBpm(params.bpmMax),
    limit: clampLimit(params.limit, DEFAULT_SEARCH_LIMIT),
    offset: clampOffset(params.offset),
  };
}

export function buildSearchTracksArgs(params: SearchTracksParams = {}): SearchTracksArgs {
  const normalized = normalizeSearchParams(params);
  return {
    q: normalized.query,
    genre: normalized.genre,
    mood: normalized.mood,
    bpm_min: normalized.bpmMin,
    bpm_max: normalized.bpmMax,
    lim: normalized.limit,
    off: normalized.offset,
  };
}

export function hasActiveSearch(params: SearchTracksParams = {}): boolean {
  const normalized = normalizeSearchParams(params);
  return (
    normalized.query !== null ||
    normalized.genre !== null ||
    normalized.mood !== null ||
    normalized.bpmMin !== null ||
    normalized.bpmMax !== null
  );
}

export function mapTrackRow(
  row: TrackRow,
  artistName: string | null,
  album: AlbumInfo | null,
): Track {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    artist: artistName ?? 'Unknown artist',
    album: album?.title ?? null,
    genre: row.genre,
    mood: row.mood,
    bpm: row.bpm,
    durationMs: row.duration_ms,
    coverUrl: row.cover_url ?? album?.coverUrl ?? null,
    license: row.license,
    licenseUrl: row.license_url,
    attribution: row.attribution,
    source: row.source,
    isPlayable: row.is_playable,
    audioUrl: null,
    audioKey: row.audio_key,
    isrc: row.isrc,
    createdAt: row.created_at,
  };
}

async function fetchArtistNames(
  client: ArtistClient,
  artistIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(artistIds)];
  if (ids.length === 0) return new Map();

  const { data, error } = await client.from('artists').select('id, name').in('id', ids);
  if (error) throw new Error(`Could not load track artists: ${error.message}`);
  return new Map((data ?? []).map((artist) => [artist.id, artist.name]));
}

async function fetchAlbums(
  client: ArtistClient,
  albumIds: string[],
): Promise<Map<string, AlbumInfo>> {
  const ids = [...new Set(albumIds)];
  if (ids.length === 0) return new Map();

  const { data, error } = await client.from('albums').select('id, title, cover_url').in('id', ids);
  if (error) throw new Error(`Could not load track albums: ${error.message}`);
  return new Map(
    (data ?? []).map((album) => [album.id, { title: album.title, coverUrl: album.cover_url }]),
  );
}

export async function mapTrackRows(client: ArtistClient, rows: TrackRow[]): Promise<Track[]> {
  if (rows.length === 0) return [];

  const albumIds = rows
    .map((row) => row.album_id)
    .filter((albumId): albumId is string => albumId !== null);

  const [artists, albums] = await Promise.all([
    fetchArtistNames(
      client,
      rows.map((row) => row.artist_id),
    ),
    fetchAlbums(client, albumIds),
  ]);

  return rows.map((row) =>
    mapTrackRow(
      row,
      artists.get(row.artist_id) ?? null,
      row.album_id ? (albums.get(row.album_id) ?? null) : null,
    ),
  );
}

export async function searchTracks(params: SearchTracksParams = {}): Promise<Track[]> {
  const client = getSupabase();
  const { data, error } = await client.rpc('search_tracks', buildSearchTracksArgs(params));
  if (error) throw new Error(`Track search failed: ${error.message}`);
  return mapTrackRows(client, data ?? []);
}

export async function getRecentlyPlayed(limit?: number | null): Promise<Track[]> {
  const client = getSupabase();
  const pageSize = clampLimit(limit);

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError) throw new Error(`Could not read your session: ${authError.message}`);
  if (!user) throw new Error('Sign in to see your recently played tracks.');

  const { data: plays, error: playsError } = await client
    .from('plays')
    .select('track_id, started_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(pageSize * 4);
  if (playsError) throw new Error(`Could not load your listening history: ${playsError.message}`);

  const trackIds: string[] = [];
  for (const play of plays ?? []) {
    if (!trackIds.includes(play.track_id)) trackIds.push(play.track_id);
    if (trackIds.length === pageSize) break;
  }
  if (trackIds.length === 0) return [];

  const { data: rows, error: tracksError } = await client
    .from('tracks')
    .select('*')
    .in('id', trackIds);
  if (tracksError) throw new Error(`Could not load recently played tracks: ${tracksError.message}`);

  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  const orderedRows = trackIds
    .map((trackId) => byId.get(trackId))
    .filter((row): row is TrackRow => row !== undefined);

  return mapTrackRows(client, orderedRows);
}

export async function getFreshTracks(limit?: number | null): Promise<Track[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from('tracks')
    .select('*')
    .eq('source', 'catalog')
    .eq('is_playable', true)
    .order('created_at', { ascending: false })
    .limit(clampLimit(limit));
  if (error) throw new Error(`Could not load fresh tracks: ${error.message}`);
  return mapTrackRows(client, data ?? []);
}

export async function getMoodShelf(mood: string, limit?: number | null): Promise<Track[]> {
  const cleanMood = normalizeText(mood);
  if (!cleanMood) return [];

  const client = getSupabase();
  const { data, error } = await client
    .from('tracks')
    .select('*')
    .eq('source', 'catalog')
    .eq('is_playable', true)
    .ilike('mood', escapeLikePattern(cleanMood))
    .order('created_at', { ascending: false })
    .limit(clampLimit(limit));
  if (error) throw new Error(`Could not load the ${cleanMood} shelf: ${error.message}`);
  return mapTrackRows(client, data ?? []);
}
export async function getLikedTracks(): Promise<Track[]> {
  const client = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError) throw new Error(`Could not read your session: ${authError.message}`);
  if (!user) throw new Error('Sign in to see liked songs.');

  const { data: likes, error: likesError } = await client
    .from('likes')
    .select('track_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (likesError) throw new Error(`Could not load liked songs: ${likesError.message}`);

  const trackIds = (likes ?? []).map((row) => row.track_id);
  if (trackIds.length === 0) return [];

  const { data: rows, error: tracksError } = await client
    .from('tracks')
    .select('*')
    .in('id', trackIds)
    .eq('is_playable', true);
  if (tracksError) throw new Error(`Could not load liked tracks: ${tracksError.message}`);

  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  const orderedRows = trackIds
    .map((trackId) => byId.get(trackId))
    .filter((row): row is TrackRow => row !== undefined);

  return mapTrackRows(client, orderedRows);
}

export async function getTracksByIds(trackIds: string[]): Promise<Track[]> {
  const ids = trackIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return [];

  const client = getSupabase();
  const { data, error } = await client
    .from('tracks')
    .select('*')
    .in('id', [...new Set(ids)]);
  if (error) throw new Error(`Could not load tracks: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Keep only playable rows for playback restore; callers can decide how to handle missing/stale IDs.
  const playableRows = rows.filter((row) => row.is_playable);
  const byId = new Map(playableRows.map((row) => [row.id, row]));
  const orderedRows = ids
    .map((id) => byId.get(id))
    .filter((row): row is TrackRow => row !== undefined);

  return mapTrackRows(client, orderedRows);
}
