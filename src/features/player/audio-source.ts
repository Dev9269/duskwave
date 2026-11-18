import type { Track } from '@/features/catalog/api';

export const AUDIO_URL_TTL_SECONDS = 3600;
export const AUDIO_URL_CACHE_LIMIT = 200;
const EXPIRY_SAFETY_SECONDS = 60;

export type AudioTrackInput = Pick<Track, 'audioKey' | 'audioUrl'>;

export type SignedAudioUrl = {
  url: string;
  expiresIn: number;
};

export type AudioUrlResolverDeps = {
  invoke: (key: string) => Promise<SignedAudioUrl>;
  createSignedUrl: (key: string, expiresIn: number) => Promise<string>;
  now?: () => number;
  maxCacheEntries?: number;
};

export type AudioUrlResolver = ((track: AudioTrackInput) => Promise<string>) & {
  reset: () => void;
};

type CacheEntry = {
  url: string;
  expiresAt: number;
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Track audio URL is invalid.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Track audio URL is invalid.');
  }
  return value;
}

function normalizeKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!key) throw new Error('Track is missing an audio key.');
  if (key.includes('..') || /^[a-z][a-z0-9+.-]*:\/\//i.test(key)) {
    throw new Error('Invalid audio key.');
  }
  return key;
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'unknown error';
}

async function getDefaultClient() {
  const { getSupabase } = await import('@/lib/supabase');
  return getSupabase();
}

async function invokeR2Sign(key: string): Promise<SignedAudioUrl> {
  const client = await getDefaultClient();
  const { data, error } = await client.functions.invoke<SignedAudioUrl>('r2-sign', {
    body: { key },
  });
  if (error) throw new Error(error.message);

  const url = typeof data?.url === 'string' ? data.url : '';
  const expiresIn = typeof data?.expiresIn === 'number' ? data.expiresIn : Number.NaN;
  if (!url || !Number.isFinite(expiresIn)) {
    throw new Error('r2-sign returned an invalid response.');
  }
  return { url, expiresIn };
}

async function createUploadsSignedUrl(key: string, expiresIn: number): Promise<string> {
  const client = await getDefaultClient();
  const { data, error } = await client.storage.from('uploads').createSignedUrl(key, expiresIn);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('Storage returned no signed URL.');
  return data.signedUrl;
}

export function createAudioUrlResolver({
  invoke,
  createSignedUrl,
  now = Date.now,
  maxCacheEntries = AUDIO_URL_CACHE_LIMIT,
}: AudioUrlResolverDeps): AudioUrlResolver {
  const cache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<string>>();
  const limit = Number.isFinite(maxCacheEntries)
    ? Math.max(1, Math.floor(maxCacheEntries))
    : AUDIO_URL_CACHE_LIMIT;

  function storeCacheEntry(key: string, entry: CacheEntry): void {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > limit) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }

  function touchCacheEntry(key: string, entry: CacheEntry): void {
    cache.delete(key);
    cache.set(key, entry);
  }

  async function fetchSignedUrl(key: string): Promise<string> {
    let signed: SignedAudioUrl;

    try {
      signed = await invoke(key);
    } catch (invokeError) {
      try {
        const url = await createSignedUrl(key, AUDIO_URL_TTL_SECONDS);
        signed = { url, expiresIn: AUDIO_URL_TTL_SECONDS };
      } catch (storageError) {
        throw new Error(
          `Could not sign audio for "${key}" (r2-sign: ${messageFrom(invokeError)}; storage: ${messageFrom(storageError)}).`,
        );
      }
    }

    const ttlMs = (signed.expiresIn - EXPIRY_SAFETY_SECONDS) * 1000;
    if (ttlMs > 0) {
      storeCacheEntry(key, { url: signed.url, expiresAt: now() + ttlMs });
    }
    return signed.url;
  }

  async function resolve(track: AudioTrackInput): Promise<string> {
    if (isHttpUrl(track.audioKey)) {
      return parseHttpUrl(track.audioKey);
    }

    const key = normalizeKey(track.audioKey);
    const cached = cache.get(key);
    if (cached && now() < cached.expiresAt) {
      touchCacheEntry(key, cached);
      return cached.url;
    }
    if (cached) cache.delete(key);

    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = fetchSignedUrl(key).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, request);
    return request;
  }

  const resolver = resolve as AudioUrlResolver;
  resolver.reset = () => {
    cache.clear();
    inFlight.clear();
  };
  return resolver;
}

let defaultResolver: AudioUrlResolver | null = null;

function getDefaultResolver(): AudioUrlResolver {
  if (!defaultResolver) {
    defaultResolver = createAudioUrlResolver({
      invoke: invokeR2Sign,
      createSignedUrl: createUploadsSignedUrl,
    });
  }
  return defaultResolver;
}

export function resolveAudioUrl(track: AudioTrackInput): Promise<string> {
  return getDefaultResolver()(track);
}

export function resetAudioUrlCache(): void {
  defaultResolver?.reset();
}
