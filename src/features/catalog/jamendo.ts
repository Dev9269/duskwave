import type { CatalogTrack } from '@/types/catalog-manifest';

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as RawRecord;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asHttpUrl(value: unknown): string | null {
  const candidate = asTrimmedString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}

function firstTag(record: RawRecord, key: 'genres' | 'vartags'): string | null {
  const tags = asRecord(asRecord(record.musicinfo)?.tags);
  const values = tags?.[key];
  if (!Array.isArray(values)) return null;

  for (const value of values) {
    const tag = asTrimmedString(value);
    if (tag) return tag;
  }
  return null;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function licenseNameFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts[0] === 'licenses' && parts.length >= 3) {
    return `CC ${parts[1].toUpperCase().replace(/_/g, '-')} ${parts[2]}`;
  }
  if (parts[0] === 'publicdomain' && parts[1] === 'zero' && parts[2]) {
    return `CC0 ${parts[2]}`;
  }
  if (parts[0] === 'publicdomain' && parts[1] === 'mark' && parts[2]) {
    return `Public Domain Mark ${parts[2]}`;
  }
  return null;
}

export function mapJamendoTrack(raw: unknown): CatalogTrack | null {
  const record = asRecord(raw);
  if (!record) return null;

  const title = asTrimmedString(record.name);
  const artist = asTrimmedString(record.artist_name);
  const audioUrl = asHttpUrl(record.audio);
  const artworkUrl = asHttpUrl(record.album_image) ?? asHttpUrl(record.image);
  const licenseUrl = asHttpUrl(record.license_ccurl);
  const license = licenseUrl ? licenseNameFromUrl(licenseUrl) : null;
  const durationSeconds = typeof record.duration === 'number' ? record.duration : Number.NaN;

  if (!title || !artist || !audioUrl || !artworkUrl || !licenseUrl || !license) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  const durationMs = Math.round(durationSeconds * 1000);
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) return null;

  const slug = slugify(`${artist} ${title}`);
  if (!slug) return null;

  return {
    slug,
    title,
    artist,
    album: asTrimmedString(record.album_name) ?? 'Single',
    genre: firstTag(record, 'genres') ?? 'mixed',
    mood: firstTag(record, 'vartags') ?? 'mellow',
    durationMs,
    audioUrl,
    artworkUrl,
    license,
    licenseUrl,
    attribution: `${artist} — ${license}`,
  };
}

export type DedupeResult = {
  tracks: CatalogTrack[];
  duplicates: number;
};

export function dedupeTracksBySlug(tracks: CatalogTrack[]): DedupeResult {
  const seen = new Set<string>();
  const unique: CatalogTrack[] = [];

  for (const track of tracks) {
    if (seen.has(track.slug)) continue;
    seen.add(track.slug);
    unique.push(track);
  }

  return { tracks: unique, duplicates: tracks.length - unique.length };
}
