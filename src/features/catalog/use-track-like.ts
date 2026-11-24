import { useCallback, useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { supabase } from '@/lib/supabase';

export function useTrackLike(trackId: string | null) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!trackId || !userId || !supabase) {
      void Promise.resolve().then(() => {
        if (active) setLiked(false);
      });
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('track_id')
          .eq('user_id', userId)
          .eq('track_id', trackId)
          .maybeSingle();
        if (!active) return;
        if (error) {
          setLiked(false);
          return;
        }
        setLiked(!!data);
      } catch {
        if (active) setLiked(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [trackId, userId]);

  const toggle = useCallback(async () => {
    if (!trackId || !userId || !supabase || busy) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setBusy(true);
    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: userId, track_id: trackId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', userId)
          .eq('track_id', trackId);
        if (error) throw error;
      }
    } catch {
      setLiked(!nextLiked);
    } finally {
      setBusy(false);
    }
  }, [busy, liked, trackId, userId]);

  const canLike = !!trackId && !!userId && !!supabase;
  return { liked, toggle, canLike, busy };
}
