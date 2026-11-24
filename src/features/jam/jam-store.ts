import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { Track } from '@/features/catalog/api';
import { usePlayerStore } from '@/features/player/player-store';
import { supabase } from '@/lib/supabase';

export type JamParticipant = { id: string; name: string };
export type JamRole = 'host' | 'guest';

type JamPlayback = { tracks: Track[]; index: number; playing: boolean };

type JamState = {
  active: boolean;
  code: string | null;
  role: JamRole | null;
  participants: JamParticipant[];
  synced: boolean;
  error: string | null;
  start: (userId: string, name: string) => Promise<void>;
  join: (code: string, userId: string, name: string) => Promise<void>;
  leave: () => Promise<void>;
};

let channel: RealtimeChannel | null = null;
let unsubscribePlayer: (() => void) | null = null;
let lastSignature = '';

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function readParticipants(activeChannel: RealtimeChannel): JamParticipant[] {
  const state = activeChannel.presenceState<JamParticipant>();
  return Object.values(state)
    .flat()
    .map((presence) => ({
      id: String(presence.id ?? ''),
      name: String(presence.name ?? 'Listener'),
    }));
}

async function attach(code: string, userId: string, name: string, role: JamRole) {
  const client = supabase;
  const fallback = () => {
    useJamStore.setState({
      active: true,
      code,
      role,
      participants: [{ id: userId, name }],
      synced: false,
      error: null,
    });
  };

  if (!client) {
    fallback();
    return;
  }

  const nextChannel = client.channel(`jam:${code}`, {
    config: { presence: { key: userId } },
  });

  nextChannel.on('presence', { event: 'sync' }, () => {
    useJamStore.setState({ participants: readParticipants(nextChannel) });
  });

  nextChannel.on('broadcast', { event: 'playback' }, ({ payload }) => {
    if (useJamStore.getState().role !== 'guest') return;
    const command = payload as JamPlayback | null;
    if (!command?.tracks?.length) return;

    void (async () => {
      await usePlayerStore.getState().playQueue(command.tracks, command.index, 'jam');
      const player = usePlayerStore.getState();
      if (!command.playing && player.isPlaying) player.toggle();
    })();
  });

  const subscribed = await new Promise<boolean>((resolve) => {
    nextChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false);
    });
  });

  if (!subscribed) {
    await client.removeChannel(nextChannel);
    fallback();
    return;
  }

  await nextChannel.track({ id: userId, name });
  channel = nextChannel;
  useJamStore.setState({
    active: true,
    code,
    role,
    participants: readParticipants(nextChannel),
    synced: true,
    error: null,
  });

  if (role === 'host') {
    lastSignature = '';
    unsubscribePlayer = usePlayerStore.subscribe((state) => {
      const signature = `${state.currentTrack?.id ?? ''}|${state.index}|${state.isPlaying}`;
      if (signature === lastSignature) return;
      lastSignature = signature;
      void channel?.send({
        type: 'broadcast',
        event: 'playback',
        payload: { tracks: state.queue, index: state.index, playing: state.isPlaying } satisfies JamPlayback,
      });
    });
  }
}

export const useJamStore = create<JamState>((set) => ({
  active: false,
  code: null,
  role: null,
  participants: [],
  synced: false,
  error: null,
  start: async (userId, name) => {
    try {
      await attach(generateCode(), userId, name, 'host');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not start a Jam.' });
    }
  },
  join: async (code, userId, name) => {
    const normalized = code.trim();
    if (!/^\d{4}$/.test(normalized)) {
      set({ error: 'Enter the 4-digit Jam code.' });
      return;
    }
    try {
      await attach(normalized, userId, name, 'guest');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not join the Jam.' });
    }
  },
  leave: async () => {
    if (unsubscribePlayer) {
      unsubscribePlayer();
      unsubscribePlayer = null;
    }
    const activeChannel = channel;
    channel = null;
    if (activeChannel) {
      try {
        await activeChannel.untrack();
        if (supabase) await supabase.removeChannel(activeChannel);
      } catch {
        // Best-effort cleanup; local state is always reset.
      }
    }
    lastSignature = '';
    set({ active: false, code: null, role: null, participants: [], synced: false, error: null });
  },
}));
