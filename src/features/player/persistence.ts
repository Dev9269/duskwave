import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { clampQueueIndex, usePlayerStore, type PlayContext } from '@/features/player/player-store';
import { getTracksByIds, type Track } from '@/features/catalog/api';
import { flushPendingScrobbles } from '@/features/player/scrobble';

export const PERSISTENCE_KEY = 'duskwave:player_state:v1';
export const SAVE_INTERVAL_MS = 30_000;

const PLAY_CONTEXTS: readonly PlayContext[] = [
  'album',
  'playlist',
  'search',
  'blend',
  'jam',
  'liked',
  'history',
];

export type PersistedPlayerState = {
  trackIds: string[];
  index: number;
  positionMs: number;
  context: PlayContext;
};

type PersistSource = {
  queue: Pick<Track, 'id'>[];
  index: number;
  positionMs: number;
  context: PlayContext;
};

function isPlayContext(value: unknown): value is PlayContext {
  return typeof value === 'string' && (PLAY_CONTEXTS as readonly string[]).includes(value);
}

function clampMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function serializePlayerState(source: PersistSource): PersistedPlayerState | null {
  const trackIds = source.queue
    .map((track) => track?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (trackIds.length === 0) return null;

  return {
    trackIds,
    index: clampQueueIndex(source.index, trackIds.length),
    positionMs: clampMs(source.positionMs),
    context: isPlayContext(source.context) ? source.context : 'history',
  };
}

function parsePersistedPlayerState(value: unknown): PersistedPlayerState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.trackIds)) return null;
  const trackIds = raw.trackIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (trackIds.length === 0) return null;

  return {
    trackIds,
    index: clampQueueIndex(typeof raw.index === 'number' ? raw.index : 0, trackIds.length),
    positionMs: clampMs(raw.positionMs),
    context: isPlayContext(raw.context) ? raw.context : 'history',
  };
}

export async function savePersistedPlayerState(state: PersistedPlayerState | null): Promise<void> {
  try {
    if (!state || state.trackIds.length === 0) {
      await AsyncStorage.removeItem(PERSISTENCE_KEY);
      return;
    }
    await AsyncStorage.setItem(PERSISTENCE_KEY, JSON.stringify(state));
  } catch {
    // Persistence/bootstrap must not block app startup or playback on errors.
  }
}

export async function saveCurrentPlayerState(): Promise<void> {
  try {
    const state = usePlayerStore.getState();
    await savePersistedPlayerState(
      serializePlayerState({
        queue: state.queue,
        index: state.index,
        positionMs: state.positionMs,
        context: state.context,
      }),
    );
  } catch {
    // ignore
  }
}

export async function loadPersistedPlayerState(): Promise<PersistedPlayerState | null> {
  try {
    const raw = await AsyncStorage.getItem(PERSISTENCE_KEY);
    if (!raw) return null;
    return parsePersistedPlayerState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clampRestorePosition(positionMs: number, track: Track | undefined): number {
  const safe = clampMs(positionMs);
  if (!track) return 0;
  const duration = Number.isFinite(track.durationMs) ? Math.max(0, Math.round(track.durationMs)) : 0;
  if (duration <= 0) return safe;
  return Math.min(safe, duration);
}

export async function restorePersistedPlayerState(): Promise<boolean> {
  try {
    try {
      await flushPendingScrobbles();
    } catch {
      // never block startup
    }

    const persisted = await loadPersistedPlayerState();
    if (!persisted) return false;

    let tracks: Track[];
    try {
      tracks = await getTracksByIds(persisted.trackIds);
    } catch {
      return false;
    }
    if (!tracks || tracks.length === 0) return false;

    const index = clampQueueIndex(persisted.index, tracks.length);
    const currentTrack = tracks[index] ?? tracks[0];
    const positionMs = clampRestorePosition(persisted.positionMs, currentTrack);
    const durationMs =
      currentTrack && Number.isFinite(currentTrack.durationMs)
        ? Math.max(0, Math.round(currentTrack.durationMs))
        : 0;

    usePlayerStore.setState({
      queue: tracks,
      index,
      context: persisted.context,
      currentTrack,
      positionMs,
      durationMs,
      isPlaying: false,
      error: null,
    });

    return true;
  } catch {
    return false;
  }
}

let started = false;
let unsubscribeStore: (() => void) | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let lastPlaying = false;

function updateSaveTimer(): void {
  const state = usePlayerStore.getState();
  const shouldRun = state.isPlaying && state.queue.length > 0;
  if (shouldRun && !saveTimer) {
    saveTimer = setInterval(() => {
      void saveCurrentPlayerState();
    }, SAVE_INTERVAL_MS);
  } else if (!shouldRun && saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
}

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'background' || nextState === 'inactive') {
    void saveCurrentPlayerState();
  }
}

export function startPlayerPersistence(): void {
  if (started) return;
  started = true;

  lastPlaying = usePlayerStore.getState().isPlaying;
  unsubscribeStore = usePlayerStore.subscribe((state) => {
    if (lastPlaying && !state.isPlaying) {
      void saveCurrentPlayerState();
    }
    lastPlaying = state.isPlaying;
    updateSaveTimer();
  });

  try {
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  } catch {
    appStateSubscription = null;
  }

  updateSaveTimer();
}

export function stopPlayerPersistence(): void {
  if (!started) return;
  started = false;
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  if (appStateSubscription) {
    try {
      appStateSubscription.remove();
    } catch {
      // ignore
    }
    appStateSubscription = null;
  }
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
}
