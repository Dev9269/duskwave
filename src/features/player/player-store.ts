import { create } from 'zustand';

import type { Track } from '@/features/catalog/api';
import type { PlayContext as DatabasePlayContext } from '@/types/database';

import {
  appendTrack,
  loadQueue,
  pause as pauseEngine,
  play as playEngine,
  seek as seekEngine,
  setEngineHandlers,
  skipTo as skipEngine,
} from './engine';

export type PlayContext = DatabasePlayContext;
export type RepeatMode = 'off' | 'all' | 'one';

export type QueueSnapshot = {
  queue: Track[];
  index: number;
  context: PlayContext;
  positionMs: number;
  durationMs: number;
  currentTrack: Track | null;
};

export function clampQueueIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  const truncated = Math.trunc(index);
  if (Number.isNaN(truncated)) return 0;
  return Math.min(Math.max(truncated, 0), length - 1);
}

export function getNextQueueIndex(index: number, length: number, wrap = false): number {
  if (length <= 0) return 0;
  const current = clampQueueIndex(index, length);
  if (current < length - 1) return current + 1;
  return wrap ? 0 : current;
}

export function getPreviousQueueIndex(index: number, length: number, wrap = false): number {
  if (length <= 0) return 0;
  const current = clampQueueIndex(index, length);
  if (current > 0) return current - 1;
  return wrap ? length - 1 : 0;
}

export function replaceQueue(
  queue: Track[],
  startIndex: number,
  context: PlayContext,
): QueueSnapshot {
  const nextQueue = [...queue];
  const index = clampQueueIndex(startIndex, nextQueue.length);

  return {
    queue: nextQueue,
    index,
    context,
    positionMs: 0,
    durationMs: 0,
    currentTrack: nextQueue[index] ?? null,
  };
}

export type PlayerState = QueueSnapshot & {
  isPlaying: boolean;
  error: string | null;
  shuffle: boolean;
  repeat: RepeatMode;
  sleepTimerEndsAt: number | null;
  playQueue: (tracks: Track[], startIndex: number, context: PlayContext) => Promise<void>;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (positionMs: number) => Promise<void>;
  appendToQueue: (track: Track) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setSleepTimer: (minutes: number | null) => void;
  removeFromQueue: (index: number) => Promise<void>;
  moveInQueue: (from: number, to: number) => Promise<void>;
};

const INITIAL_STATE: QueueSnapshot &
  Pick<PlayerState, 'isPlaying' | 'error' | 'shuffle' | 'repeat' | 'sleepTimerEndsAt'> = {
  queue: [],
  index: 0,
  context: 'history',
  positionMs: 0,
  durationMs: 0,
  currentTrack: null,
  isPlaying: false,
  error: null,
  shuffle: false,
  repeat: 'off',
  sleepTimerEndsAt: null,
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Playback failed.';
}

let resumeInFlight = false;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ...INITIAL_STATE,
  playQueue: async (tracks, startIndex, context) => {
    const snapshot = replaceQueue(tracks, startIndex, context);
    set({ ...snapshot, isPlaying: false, error: null });

    try {
      const applied = await loadQueue(snapshot.queue, snapshot.index, { context });
      if (applied) set({ error: null });
    } catch (error) {
      set({ error: errorMessage(error), isPlaying: false });
    }
  },
  toggle: () => {
    const state = get();
    if (state.queue.length === 0) return;

    if (state.isPlaying) {
      if (pauseEngine()) set({ isPlaying: false });
      return;
    }
    if (playEngine()) {
      set({ isPlaying: true });
      return;
    }
    if (resumeInFlight) return;
    resumeInFlight = true;

    const resumePositionMs = state.positionMs;
    void (async () => {
      try {
        const latest = get();
        if (latest.queue.length === 0) return;

        const applied = await loadQueue(latest.queue, latest.index, {
          autoplay: false,
          context: latest.context,
        });
        if (!applied) return;

        if (resumePositionMs > 0) {
          await seekEngine(resumePositionMs / 1000);
        }
        if (playEngine()) {
          set({ isPlaying: true, positionMs: resumePositionMs, error: null });
        }
      } catch (error) {
        set({ error: errorMessage(error), isPlaying: false });
      } finally {
        resumeInFlight = false;
      }
    })();
  },
  next: () => {
    const state = get();
    if (state.queue.length === 0) return;

    let nextIndex = state.index;
    if (state.shuffle && state.queue.length > 1) {
      while (nextIndex === state.index) {
        nextIndex = Math.floor(Math.random() * state.queue.length);
      }
    } else {
      nextIndex = getNextQueueIndex(
        state.index,
        state.queue.length,
        state.repeat === 'all',
      );
    }
    if (nextIndex === state.index) return;

    set({
      index: nextIndex,
      currentTrack: state.queue[nextIndex] ?? null,
      positionMs: 0,
      durationMs: 0,
    });
    skipEngine(nextIndex);
  },
  previous: () => {
    const state = get();
    if (state.queue.length === 0) return;

    const previousIndex = getPreviousQueueIndex(
      state.index,
      state.queue.length,
      state.repeat === 'all',
    );
    if (previousIndex === state.index) return;

    set({
      index: previousIndex,
      currentTrack: state.queue[previousIndex] ?? null,
      positionMs: 0,
      durationMs: 0,
    });
    skipEngine(previousIndex);
  },
  seek: async (positionMs) => {
    const state = get();
    if (state.queue.length === 0) return;

    const upperBound = state.durationMs > 0 ? state.durationMs : Number.MAX_SAFE_INTEGER;
    const clamped = Math.min(Math.max(Math.round(positionMs), 0), upperBound);

    try {
      await seekEngine(clamped / 1000);
      set({ positionMs: clamped });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  appendToQueue: async (track) => {
    const state = get();

    if (state.queue.length === 0) {
      const snapshot = replaceQueue([track], 0, state.context);
      set({ ...snapshot, isPlaying: false, error: null });

      try {
        await loadQueue(snapshot.queue, 0, { autoplay: false, context: snapshot.context });
        set({ error: null });
      } catch (error) {
        set({ error: errorMessage(error), isPlaying: false });
      }
      return;
    }

    try {
      await appendTrack(track);
      set({ queue: [...get().queue, track], error: null });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  toggleShuffle: () => {
    set((state) => ({ shuffle: !state.shuffle }));
  },
  cycleRepeat: () => {
    set((state) => ({
      repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
    }));
  },
  setSleepTimer: (minutes) => {
    set({
      sleepTimerEndsAt: minutes === null ? null : Date.now() + minutes * 60_000,
    });
  },
  removeFromQueue: async (targetIndex) => {
    const state = get();
    if (targetIndex < 0 || targetIndex >= state.queue.length || state.queue.length <= 1) return;

    const queue = state.queue.filter((_, i) => i !== targetIndex);
    const index = Math.min(state.index, queue.length - 1);
    set({ queue, index, currentTrack: queue[index] ?? null, error: null });

    try {
      await loadQueue(queue, index, { autoplay: state.isPlaying, context: state.context });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
  moveInQueue: async (from, to) => {
    const state = get();
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= state.queue.length ||
      to >= state.queue.length
    ) {
      return;
    }

    const queue = [...state.queue];
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    const index = state.index === from ? to : state.index;
    set({ queue, index, currentTrack: queue[index] ?? null, error: null });

    try {
      await loadQueue(queue, index, { autoplay: state.isPlaying, context: state.context });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },
}));

setEngineHandlers({
  onStatus: (status) => {
    usePlayerStore.setState({
      positionMs: Math.round(status.currentTime * 1000),
      durationMs: Math.round(status.duration * 1000),
      isPlaying: status.playing,
    });
  },
  onTrackChanged: ({ currentIndex }) => {
    const { queue } = usePlayerStore.getState();
    if (queue.length === 0) return;

    const index = clampQueueIndex(currentIndex, queue.length);
    usePlayerStore.setState({
      index,
      currentTrack: queue[index] ?? null,
      positionMs: 0,
      durationMs: 0,
    });
  },
  onError: (message) => {
    usePlayerStore.setState({ error: message });
  },
});
