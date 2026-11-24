import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Track } from '@/features/catalog/api';
import { getSupabase } from '@/lib/supabase';
import { getTracksByIds } from '@/features/catalog/api';
import { flushPendingScrobbles } from '@/features/player/scrobble';
import { usePlayerStore } from '@/features/player/player-store';

import {
  PERSISTENCE_KEY,
  loadPersistedPlayerState,
  restorePersistedPlayerState,
  savePersistedPlayerState,
  serializePlayerState,
} from '../persistence';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

jest.mock('@/features/catalog/api', () => {
  const actual = jest.requireActual('@/features/catalog/api');
  return {
    ...actual,
    getTracksByIds: jest.fn(),
  };
});

jest.mock('@/features/player/scrobble', () => ({
  flushPendingScrobbles: jest.fn(),
}));

const getItemMock = AsyncStorage.getItem as jest.Mock;
const setItemMock = AsyncStorage.setItem as jest.Mock;
const removeItemMock = AsyncStorage.removeItem as jest.Mock;
const getSupabaseMock = getSupabase as jest.Mock;
const getTracksByIdsMock = getTracksByIds as jest.Mock;
const flushPendingScrobblesMock = flushPendingScrobbles as jest.Mock;

function makeTrack(id: string, durationMs = 180_000): Track {
  return {
    id,
    slug: id,
    title: `Track ${id}`,
    artist: 'Artist',
    album: 'Album',
    genre: 'electronic',
    mood: 'chill',
    bpm: 120,
    durationMs,
    coverUrl: null,
    license: 'CC BY',
    licenseUrl: 'https://example.com/license',
    attribution: 'Artist',
    source: 'catalog',
    isPlayable: true,
    audioUrl: null,
    audioKey: `catalog/${id}.mp3`,
    isrc: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const EMPTY = {
  queue: [],
  index: 0,
  context: 'history' as const,
  positionMs: 0,
  durationMs: 0,
  currentTrack: null,
  isPlaying: false,
  error: null,
};

beforeEach(() => {
  jest.useFakeTimers();
  getItemMock.mockReset().mockResolvedValue(null);
  setItemMock.mockReset().mockResolvedValue(undefined);
  removeItemMock.mockReset().mockResolvedValue(undefined);
  getSupabaseMock.mockReset().mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  });
  getTracksByIdsMock.mockReset().mockResolvedValue([]);
  flushPendingScrobblesMock.mockReset().mockResolvedValue(undefined);
  usePlayerStore.setState(EMPTY);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('serializePlayerState', () => {
  it('round-trips track IDs, index, position, and context', () => {
    const payload = serializePlayerState({
      queue: [makeTrack('a'), makeTrack('b')],
      index: 1,
      positionMs: 12_345,
      context: 'search',
    });

    expect(payload).toEqual({
      trackIds: ['a', 'b'],
      index: 1,
      positionMs: 12_345,
      context: 'search',
    });
  });

  it('clamps invalid index/position and drops empty payloads to null', () => {
    expect(
      serializePlayerState({
        queue: [makeTrack('a')],
        index: -5,
        positionMs: -10,
        context: 'album',
      }),
    ).toEqual({ trackIds: ['a'], index: 0, positionMs: 0, context: 'album' });

    expect(serializePlayerState({ queue: [], index: 0, positionMs: 0, context: 'history' })).toBeNull();
  });
});

describe('load/save persisted player state', () => {
  it('saves payload to AsyncStorage and ignores storage errors', async () => {
    await savePersistedPlayerState({
      trackIds: ['a', 'b'],
      index: 1,
      positionMs: 5000,
      context: 'liked',
    });
    expect(setItemMock).toHaveBeenCalledWith(PERSISTENCE_KEY, expect.any(String));

    setItemMock.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      savePersistedPlayerState({ trackIds: ['a'], index: 0, positionMs: 0, context: 'history' }),
    ).resolves.toBeUndefined();
  });

  it('loads valid payloads and ignores invalid/missing data', async () => {
    getItemMock.mockResolvedValueOnce(
      JSON.stringify({ trackIds: ['a', 'b'], index: 1, positionMs: 2500, context: 'search' }),
    );
    await expect(loadPersistedPlayerState()).resolves.toEqual({
      trackIds: ['a', 'b'],
      index: 1,
      positionMs: 2500,
      context: 'search',
    });

    getItemMock.mockResolvedValueOnce('not json');
    await expect(loadPersistedPlayerState()).resolves.toBeNull();
    getItemMock.mockResolvedValueOnce(JSON.stringify({ trackIds: [], index: 0, positionMs: 0, context: 'search' }));
    await expect(loadPersistedPlayerState()).resolves.toBeNull();
  });
});

describe('restorePersistedPlayerState', () => {
  it('restores queue paused with position, drops stale IDs, clamps index/position, never autoplays', async () => {
    getItemMock.mockResolvedValueOnce(
      JSON.stringify({ trackIds: ['a', 'missing', 'b'], index: 9, positionMs: 999_999, context: 'playlist' }),
    );
    const a = makeTrack('a', 100_000);
    const b = makeTrack('b', 200_000);
    getTracksByIdsMock.mockResolvedValueOnce([a, b]);

    const restored = await restorePersistedPlayerState();

    expect(flushPendingScrobblesMock).toHaveBeenCalled();
    expect(getTracksByIdsMock).toHaveBeenCalledWith(['a', 'missing', 'b']);
    expect(restored).toBe(true);

    const state = usePlayerStore.getState();
    expect(state.queue.map((t) => t.id)).toEqual(['a', 'b']);
    expect(state.index).toBe(1); // clamped to last found
    expect(state.currentTrack?.id).toBe('b');
    expect(state.positionMs).toBe(200_000); // clamped to duration
    expect(state.durationMs).toBe(200_000);
    expect(state.isPlaying).toBe(false);
    expect(state.context).toBe('playlist');
  });

  it('does not restore when data is missing, invalid, unauthenticated/unresolvable, or errors occur', async () => {
    await expect(restorePersistedPlayerState()).resolves.toBe(false);
    expect(flushPendingScrobblesMock).toHaveBeenCalled();
    expect(usePlayerStore.getState().queue).toEqual([]);

    flushPendingScrobblesMock.mockClear();
    getItemMock.mockResolvedValueOnce(JSON.stringify({ nope: true }));
    await expect(restorePersistedPlayerState()).resolves.toBe(false);

    flushPendingScrobblesMock.mockClear();
    getItemMock.mockResolvedValueOnce(JSON.stringify({ trackIds: ['a'], index: 0, positionMs: 0, context: 'history' }));
    getTracksByIdsMock.mockRejectedValueOnce(new Error('network'));
    await expect(restorePersistedPlayerState()).resolves.toBe(false);
    expect(usePlayerStore.getState().queue).toEqual([]);
  });
});
