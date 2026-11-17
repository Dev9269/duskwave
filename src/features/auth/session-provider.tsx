import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function isOnboarded(profile: Profile | null): boolean {
  if (!profile) return false;
  const onboarding = profile.onboarding;
  if (typeof onboarding !== 'object' || onboarding === null || Array.isArray(onboarding)) {
    return false;
  }
  return (onboarding as Record<string, unknown>).completed === true;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    let active = true;

    const applySession = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      if (next) {
        try {
          await loadProfile(next.user.id);
        } catch {
          if (active) setProfile(null);
        }
      } else {
        setProfile(null);
      }
      if (active) setLoading(false);
    };

    client.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      setLoading(true);
      void applySession(next);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    await loadProfile(session.user.id).catch(() => setProfile(null));
  }, [loadProfile, session]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      configured: supabase !== null,
      refreshProfile,
      signOut,
    }),
    [loading, profile, refreshProfile, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider.');
  }
  return context;
}
