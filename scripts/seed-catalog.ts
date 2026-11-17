import { existsSync, readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { AwsClient } from 'aws4fetch';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  CatalogManifestSchema,
  formatIssues,
  type CatalogTrack,
} from '../src/types/catalog-manifest';
import type { Database } from '../src/types/database';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

type Options = {
  dryRun: boolean;
  limit: number | null;
  force: boolean;
  verify: boolean;
  file: string;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    limit: null,
    force: false,
    verify: false,
    file: existsSync('catalog/manifest.json')
      ? 'catalog/manifest.json'
      : 'catalog/manifest.example.json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--verify') {
      options.verify = true;
    } else if (arg === '--limit') {
      const raw = argv[index + 1];
      const parsed = Number.parseInt(raw ?? '', 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('--limit expects a positive integer.');
      }
      options.limit = parsed;
      index += 1;
    } else if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
    } else if (arg === '--file') {
      options.file = argv[index + 1] ?? options.file;
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return options;
}

function serverEnv(): { url: string; serviceKey: string } | null {
  const url = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function extensionFor(url: string, fallback: string): string {
  const match = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(url);
  return match ? match[1].toLowerCase() : fallback;
}

async function uploadToR2(
  r2: AwsClient,
  config: R2Config,
  track: CatalogTrack,
  force: boolean,
): Promise<string> {
  const key = `catalog/${track.slug}.${extensionFor(track.audioUrl, 'mp3')}`;
  const objectUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;

  if (!force) {
    const head = await r2.fetch(objectUrl, { method: 'HEAD' });
    if (head.ok) return key;
  }

  const source = await fetch(track.audioUrl);
  if (!source.ok) {
    throw new Error(`Could not download audio for ${track.slug} (${source.status}).`);
  }
  const body = await source.arrayBuffer();
  const put = await r2.fetch(objectUrl, {
    method: 'PUT',
    body,
    headers: { 'content-type': 'audio/mpeg' },
  });
  if (!put.ok) {
    throw new Error(`R2 upload failed for ${track.slug} (${put.status}).`);
  }
  return key;
}

async function uploadAudioToStorage(
  client: SupabaseClient<Database>,
  track: CatalogTrack,
  force: boolean,
): Promise<string> {
  const path = `catalog/${track.slug}.${extensionFor(track.audioUrl, 'mp3')}`;
  const source = await fetch(track.audioUrl);
  if (!source.ok) {
    throw new Error(`Could not download audio for ${track.slug} (${source.status}).`);
  }
  const body = await source.arrayBuffer();
  const { error } = await client.storage
    .from('uploads')
    .upload(path, body, { contentType: 'audio/mpeg', upsert: force });
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Storage upload failed for ${track.slug}: ${error.message}`);
  }
  return path;
}

async function uploadArtworkToStorage(
  client: SupabaseClient<Database>,
  track: CatalogTrack,
  force: boolean,
): Promise<string> {
  const path = `catalog/${track.slug}.${extensionFor(track.artworkUrl, 'jpg')}`;
  const source = await fetch(track.artworkUrl);
  if (!source.ok) return track.artworkUrl;

  const body = await source.arrayBuffer();
  const { error } = await client.storage
    .from('artwork')
    .upload(path, body, { contentType: 'image/jpeg', upsert: force });
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Artwork upload failed for ${track.slug}: ${error.message}`);
  }

  return client.storage.from('artwork').getPublicUrl(path).data.publicUrl;
}

async function ensureArtist(client: SupabaseClient<Database>, name: string): Promise<string> {
  const existing = await client.from('artists').select('id').eq('name', name).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id;

  const inserted = await client.from('artists').insert({ name }).select('id').single();
  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? `Could not create artist ${name}.`);
  }
  return inserted.data.id;
}

async function ensureAlbum(
  client: SupabaseClient<Database>,
  artistId: string,
  title: string,
  coverUrl: string,
): Promise<string> {
  const existing = await client
    .from('albums')
    .select('id')
    .eq('artist_id', artistId)
    .eq('title', title)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id;

  const inserted = await client
    .from('albums')
    .insert({ artist_id: artistId, title, cover_url: coverUrl })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? `Could not create album ${title}.`);
  }
  return inserted.data.id;
}

async function seedTrack(
  client: SupabaseClient<Database>,
  track: CatalogTrack,
  options: Options,
  r2: { client: AwsClient; config: R2Config } | null,
): Promise<void> {
  const artistId = await ensureArtist(client, track.artist);

  const audioKey = r2
    ? await uploadToR2(r2.client, r2.config, track, options.force)
    : await uploadAudioToStorage(client, track, options.force);
  const coverUrl = await uploadArtworkToStorage(client, track, options.force);
  const albumId = await ensureAlbum(client, artistId, track.album, coverUrl);

  const { error } = await client.from('tracks').upsert(
    {
      slug: track.slug,
      title: track.title,
      artist_id: artistId,
      album_id: albumId,
      duration_ms: track.durationMs,
      audio_key: audioKey,
      cover_url: coverUrl,
      isrc: track.isrc ?? null,
      genre: track.genre,
      mood: track.mood,
      source: 'catalog',
      is_playable: true,
      license: track.license,
      license_url: track.licenseUrl,
      attribution: track.attribution,
    },
    { onConflict: 'slug' },
  );

  if (error) {
    throw new Error(`Track upsert failed for ${track.slug}: ${error.message}`);
  }
}

async function verifyTracks(
  client: SupabaseClient<Database>,
  tracks: CatalogTrack[],
): Promise<boolean> {
  const slugs = tracks.map((track) => track.slug);
  const { data, error } = await client.from('tracks').select('slug, audio_key').in('slug', slugs);
  if (error) throw new Error(error.message);

  const rows = new Map((data ?? []).map((row) => [row.slug, row.audio_key]));
  let ok = true;

  for (const slug of slugs) {
    const audioKey = rows.get(slug);
    if (audioKey === undefined) {
      console.error(`  MISSING row: ${slug}`);
      ok = false;
    } else if (!audioKey) {
      console.error(`  MISSING audio_key: ${slug}`);
      ok = false;
    }
  }

  const found = slugs.filter((slug) => Boolean(rows.get(slug))).length;
  console.log(`Verified ${found} of ${slugs.length} manifest tracks.`);
  return ok;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.file)) {
    throw new Error(`Manifest not found: ${options.file}`);
  }

  const raw = JSON.parse(readFileSync(options.file, 'utf8')) as unknown;
  const parsed = CatalogManifestSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('Manifest validation failed:');
    console.error(formatIssues(parsed.error));
    process.exitCode = 1;
    return;
  }

  const tracks = options.limit ? parsed.data.tracks.slice(0, options.limit) : parsed.data.tracks;

  console.log('Duskwave catalog seed');
  console.log(`manifest: ${options.file}`);
  console.log(`tracks: ${tracks.length}${options.limit ? ` (limit ${options.limit})` : ''}`);

  if (options.dryRun) {
    tracks.forEach((track, index) => {
      console.log(
        `${index + 1}. ${track.slug} — ${track.title} by ${track.artist} ` +
          `(${track.license}) → upsert artist, album, track; upload audio + artwork`,
      );
    });
    console.log('Dry run: no writes performed.');
    return;
  }

  const env = serverEnv();
  if (!env) {
    throw new Error(
      'Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY to write the catalog.',
    );
  }

  const client = createClient<Database>(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (options.verify) {
    const ok = await verifyTracks(client, tracks);
    if (!ok) process.exitCode = 1;
    return;
  }

  const r2Env = r2Config();
  const r2 = r2Env
    ? {
        client: new AwsClient({
          accessKeyId: r2Env.accessKeyId,
          secretAccessKey: r2Env.secretAccessKey,
          service: 's3',
          region: 'auto',
        }),
        config: r2Env,
      }
    : null;

  console.log(r2 ? `uploads: R2 bucket ${r2.config.bucket}` : 'uploads: Supabase Storage (uploads)');

  for (const [index, track] of tracks.entries()) {
    await seedTrack(client, track, options, r2);
    console.log(`  [${index + 1}/${tracks.length}] ${track.slug} ok`);
  }

  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
