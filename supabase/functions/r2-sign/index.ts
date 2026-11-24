// Deno resolves these remote imports at deploy time; the app's tsc cannot.
// @ts-expect-error -- remote Deno import
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'; // eslint-disable-line import/no-unresolved
// @ts-expect-error -- remote Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'; // eslint-disable-line import/no-unresolved

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_KEY_LENGTH = 1024;
const UPLOADS_BUCKET = 'uploads';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type StorageConfig = {
  url: string;
  serviceKey: string;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function r2Config(): R2Config | null {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')?.trim();
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')?.trim();
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')?.trim();
  const bucket = Deno.env.get('R2_BUCKET')?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function storageConfig(): StorageConfig | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

function normalizeKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (!key || key.length > MAX_KEY_LENGTH) return null;
  if (key.includes('..')) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(key)) return null;
  return key;
}

function encodeObjectKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function signR2Url(config: R2Config, key: string): Promise<string> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const objectUrl =
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodeObjectKey(key)}`;
  const signed = await client.sign(
    `${objectUrl}?X-Amz-Expires=${SIGNED_URL_TTL_SECONDS}`,
    { method: 'GET', aws: { signQuery: true } },
  );
  return signed.url;
}

async function signStorageUrl(config: StorageConfig, key: string): Promise<string> {
  const client = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error('Storage signing failed.');
  }
  return data.signedUrl;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be JSON.' }, 400);
  }

  const key = normalizeKey((payload as { key?: unknown } | null)?.key);
  if (!key) {
    return jsonResponse({ error: 'A valid "key" is required.' }, 400);
  }

  const r2 = r2Config();
  if (r2) {
    try {
      const url = await signR2Url(r2, key);
      return jsonResponse({ url, expiresIn: SIGNED_URL_TTL_SECONDS }, 200);
    } catch {
      // Fall through to Supabase Storage.
    }
  }

  const storage = storageConfig();
  if (!storage) {
    return jsonResponse(
      { error: r2 ? 'Could not sign audio.' : 'Audio signing is not configured.' },
      r2 ? 502 : 500,
    );
  }

  try {
    const url = await signStorageUrl(storage, key);
    return jsonResponse({ url, expiresIn: SIGNED_URL_TTL_SECONDS }, 200);
  } catch {
    return jsonResponse({ error: 'Could not sign audio.' }, 502);
  }
});
