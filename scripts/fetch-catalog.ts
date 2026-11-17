import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

import {
  CatalogManifestSchema,
  formatIssues,
  type CatalogTrack,
} from '../src/types/catalog-manifest';
import { dedupeTracksBySlug, mapJamendoTrack } from '../src/features/catalog/jamendo';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const API_URL = 'https://api.jamendo.com/v3.0/tracks/';
const DEFAULT_LIMIT = 200;
const PAGE_SIZE = 200;

type Options = {
  limit: number;
  out: string;
};

type JamendoHeaders = {
  status?: unknown;
  code?: unknown;
  error_message?: unknown;
};

type JamendoResponse = {
  headers?: JamendoHeaders;
  results?: unknown;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { limit: DEFAULT_LIMIT, out: 'catalog/manifest.json' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--limit' || arg.startsWith('--limit=')) {
      const raw = arg === '--limit' ? argv[index + 1] : arg.slice('--limit='.length);
      if (arg === '--limit') index += 1;
      const parsed = Number.parseInt(raw ?? '', 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('--limit expects a positive integer.');
      }
      options.limit = parsed;
    } else if (arg === '--out' || arg.startsWith('--out=')) {
      const value = arg === '--out' ? argv[index + 1] : arg.slice('--out='.length);
      if (arg === '--out') index += 1;
      if (!value || value.trim().length === 0) {
        throw new Error('--out expects a file path.');
      }
      options.out = value.trim();
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return options;
}

async function fetchPage(clientId: string, limit: number, offset: number): Promise<unknown[]> {
  const url = new URL(API_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('include', 'musicinfo');
  url.searchParams.set('audioformat', 'mp32');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Jamendo request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as JamendoResponse;
  const status = typeof payload.headers?.status === 'string' ? payload.headers.status : null;
  if (status && status !== 'success') {
    const message =
      typeof payload.headers?.error_message === 'string' &&
      payload.headers.error_message.trim().length > 0
        ? payload.headers.error_message.trim()
        : 'unknown error';
    throw new Error(`Jamendo API error: ${message}`);
  }

  if (!Array.isArray(payload.results)) {
    throw new Error('Jamendo response did not include a results array.');
  }
  return payload.results;
}

async function fetchTracks(clientId: string, limit: number): Promise<unknown[]> {
  const rawTracks: unknown[] = [];
  let offset = 0;

  while (rawTracks.length < limit) {
    const pageSize = Math.min(PAGE_SIZE, limit - rawTracks.length);
    const page = await fetchPage(clientId, pageSize, offset);
    rawTracks.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }

  return rawTracks;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const clientId = process.env.JAMENDO_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error(
      'Set JAMENDO_CLIENT_ID to a free Jamendo API client ID (https://devportal.jamendo.com).',
    );
  }

  const fetched = await fetchTracks(clientId, options.limit);
  const mapped: CatalogTrack[] = [];

  for (const raw of fetched) {
    const track = mapJamendoTrack(raw);
    if (track) mapped.push(track);
  }

  const { tracks, duplicates } = dedupeTracksBySlug(mapped);
  const skipped = fetched.length - mapped.length;

  console.log(`Fetched ${fetched.length} Jamendo tracks (limit ${options.limit}).`);
  console.log(
    `Mapped ${mapped.length}, skipped ${skipped}, duplicates ${duplicates}, output ${tracks.length}.`,
  );

  if (fetched.length === 0) {
    throw new Error('Jamendo returned no tracks; refusing to write an empty manifest.');
  }
  if (tracks.length === 0) {
    throw new Error(
      'No playable Jamendo tracks survived mapping; refusing to write an empty manifest.',
    );
  }

  const parsed = CatalogManifestSchema.safeParse({ version: 1, tracks });
  if (!parsed.success) {
    console.error('Manifest validation failed:');
    console.error(formatIssues(parsed.error));
    process.exitCode = 1;
    return;
  }

  const outPath = resolve(options.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${parsed.data.tracks.length} tracks to ${options.out}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
