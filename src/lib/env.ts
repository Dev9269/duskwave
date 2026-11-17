export type SupabaseEnvInput = {
  url?: string | null;
  anonKey?: string | null;
};

export type SupabaseEnv = {
  url: string | null;
  anonKey: string | null;
  configured: boolean;
};

function isValidSupabaseUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  if (/^http:\/\//i.test(value)) {
    return /^http:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?\/?$/i.test(value);
  }
  return true;
}

export function parseSupabaseEnv(input: SupabaseEnvInput = {}): SupabaseEnv {
  const url = input.url?.trim() ?? '';
  const anonKey = input.anonKey?.trim() ?? '';
  const configured = url.length > 0 && anonKey.length > 0 && isValidSupabaseUrl(url);
  return {
    url: configured ? url : null,
    anonKey: configured ? anonKey : null,
    configured,
  };
}

export const supabaseEnv = parseSupabaseEnv({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

export const spotifyClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim() || null;
