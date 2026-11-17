import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Provider } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type OAuthResult = { error: string | null; cancelled?: boolean };

export function authCallbackUrl(): string {
  return Linking.createURL('auth-callback');
}

export async function setSessionFromUrl(url: string): Promise<OAuthResult> {
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');
  const read = (key: string) => fragment.get(key) ?? parsed.searchParams.get(key);

  const errorDescription = read('error_description') ?? read('error');
  if (errorDescription) {
    return { error: errorDescription.replace(/\+/g, ' ') };
  }

  const code = read('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error: error?.message ?? null };
  }

  const accessToken = read('access_token');
  const refreshToken = read('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { error: error?.message ?? null };
  }

  return { error: 'The sign-in response did not include a session.' };
}

export async function signInWithProvider(provider: Provider): Promise<OAuthResult> {
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const redirectTo = authCallbackUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { error: error?.message ?? 'Could not start sign-in.' };
  }

  const browser = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (browser.type !== 'success') {
    return { error: null, cancelled: true };
  }

  return setSessionFromUrl(browser.url);
}
