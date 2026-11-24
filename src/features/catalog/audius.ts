import { audiusEnv } from '@/lib/env';

import { normalizeText, type Track } from './api';

export const AUDIUS_SEARCH_LIMIT = 20;
export const AUDIUS_MIN_QUERY_LENGTH = 2;
export const AUDIUS_TIMEOUT_MS = 8_000;

type AudiusImage = Record<string, string | null | undefined> | null | undefined;

export type AudiusUser = {
  name?: string | null;
  handle?: string | null;
  profile_picture?: AudiusImage | string | null;
};

export type AudiusTrack = {
  id?: string | null;
  title?: string | null;
  user?: AudiusUser | null;
  artwork?: AudiusImage;
  duration?: number | null;
  genre?: string | null;
  mood?: string | null;
  bpm?: number | null;
  isrc?: string | null;
  tags?: string | null;
  release_date?: string | null;
  created_at?: string | null;
  is_streamable?: boolean | null;
  is_stream_gated?: boolean | null;
  access?: { stream?: boolean | null } | null;
  is_available?: boolean | null;
  is_delete?: boolean | null;
};

export function buildAudiusStreamUrl(rawId: string): string {
  const base = audiusEnv.apiBaseUrl.replace(/\/+$/, '');
  const id = encodeURIComponent(rawId);
  const appName = encodeURIComponent(audiusEnv.appName);
  return `${base}/tracks/${id}/stream?app_name=${appName}`;
}

function buildAudiusSearchUrl(query: string, limit: number): string {
  const base = audiusEnv.apiBaseUrl.replace(/\/+$/, '');
  return `${base}/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${encodeURIComponent(audiusEnv.appName)}`;
}

const EXCLUDED_AUDIO_GENRES = new Set(['podcast', 'podcasts', 'audiobook', 'audiobooks']);
const EXCLUDED_AUDIO_TAGS = new Set(['podcast', 'audiobook', 'audiobooks', 'interview', 'spokenword']);

function isExcludedAudiusContent(raw: AudiusTrack): boolean {
  const genre = normalizeText(raw.genre)?.toLowerCase();
  if (genre && EXCLUDED_AUDIO_GENRES.has(genre)) return true;

  const tags = normalizeText(raw.tags)?.toLowerCase();
  if (!tags) return false;
  return tags.split(',').some((tag) => EXCLUDED_AUDIO_TAGS.has(tag.trim()));
}

function isPlayableAudiusTrack(raw: AudiusTrack): boolean {
  return (
    normalizeText(raw.id) !== null &&
    normalizeText(raw.title) !== null &&
    raw.is_streamable === true &&
    raw.is_stream_gated !== true &&
    raw.access?.stream !== false &&
    raw.is_available !== false &&
    raw.is_delete !== true &&
    typeof raw.duration === 'number' &&
    Number.isFinite(raw.duration) &&
    raw.duration >= 30 &&
    !isExcludedAudiusContent(raw)
  );
}

function artworkFor(raw: AudiusTrack): string | null {
  const artwork =
    normalizeText(raw.artwork?.['480x480']) ??
    normalizeText(raw.artwork?.['150x150']);
  if (artwork) return artwork;

  const profilePicture = raw.user?.profile_picture;
  if (typeof profilePicture === 'string') return normalizeText(profilePicture);

  return (
    normalizeText(profilePicture?.['480x480']) ??
    normalizeText(profilePicture?.['150x150'])
  );
}

export function mapAudiusTrack(raw: AudiusTrack): Track | null {
  if (!raw || !isPlayableAudiusTrack(raw)) return null;

  const rawId = normalizeText(raw.id) as string;
  const title = normalizeText(raw.title) as string;
  const duration = raw.duration as number;
  const streamUrl = buildAudiusStreamUrl(rawId);
  const artist =
    normalizeText(raw.user?.name) ??
    normalizeText(raw.user?.handle) ??
    'Unknown artist';
  const bpm =
    typeof raw.bpm === 'number' && Number.isFinite(raw.bpm) ? raw.bpm : null;
  const createdAt =
    normalizeText(raw.release_date) ??
    normalizeText(raw.created_at) ??
    new Date(0).toISOString();

  return {
    id: `audius:${rawId}`,
    slug: `audius-${rawId}`,
    title,
    artist,
    album: null,
    genre: normalizeText(raw.genre),
    mood: normalizeText(raw.mood),
    bpm,
    durationMs: Math.max(0, Math.round(duration * 1000)),
    coverUrl: artworkFor(raw),
    license: null,
    licenseUrl: null,
    attribution: 'Streamed via Audius',
    source: 'audius',
    isPlayable: true,
    audioUrl: streamUrl,
    audioKey: streamUrl,
    isrc: normalizeText(raw.isrc),
    createdAt,
  };
}

function mapAudiusTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];

  const tracks: Track[] = [];
  for (const candidate of value) {
    try {
      const track = mapAudiusTrack(candidate as AudiusTrack);
      if (track) tracks.push(track);
    } catch {
      // One malformed record must not hide the rest of the response.
    }
  }
  return tracks;
}

export async function searchAudiusTracks(query: string): Promise<Track[]> {
  const normalized = normalizeText(query);
  if (!normalized || normalized.length < AUDIUS_MIN_QUERY_LENGTH) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIUS_TIMEOUT_MS);

  try {
    const response = await fetch(buildAudiusSearchUrl(normalized, AUDIUS_SEARCH_LIMIT), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Audius search failed (${response.status}).`);
    }

    const payload = (await response.json()) as { data?: unknown };
    return mapAudiusTracks(payload?.data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Audius search timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function matchKey(track: Pick<Track, 'title' | 'artist'>): string {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalize(track.title)}\u0000${normalize(track.artist)}`;
}

export function mergeSearchResults(local: Track[], audius: Track[]): Track[] {
  const seen = new Set(local.map(matchKey));
  const merged = [...local];

  for (const track of audius) {
    const key = matchKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(track);
  }

  return merged;
}
