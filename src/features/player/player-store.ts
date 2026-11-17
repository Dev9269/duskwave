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
  playQueue: (tracks: Track[], startIndex: number, context: PlayContext) => Promise<void>;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (positionMs: number) => Promise<void>;
  appendToQueue: (track: Track) => Promise<void>;
};

const INITIAL_STATE: QueueSnapshot & Pick<PlayerState, 'isPlaying' | 'error'> = {
  queue: [],
  index: 0,
  context: 'history',
  positionMs: 0,
  durationMs: 0,
  currentTrack: null,
  isPlaying: false,
  error: null,
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Playback failed.';
}

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
    if (playEngine()) set({ isPlaying: true });
  },
  next: () => {
    const state = get();
    const nextIndex = getNextQueueIndex(state.index, state.queue.length);
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
    const previousIndex = getPreviousQueueIndex(state.index, state.queue.length);
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
