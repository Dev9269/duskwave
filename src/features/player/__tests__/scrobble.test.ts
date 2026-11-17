import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import type { Track } from '@/features/catalog/api';
import { getSupabase } from '@/lib/supabase';

import {
  __resetScrobbleStateForTests,
  flushPendingScrobbles,
  isCompleted,
  onAppBackground,
  onPause,
  onPlaybackProgress,
  onTrackFinished,
  startScrobble,
} from '../scrobble';

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => {
  let handler: ((state: string) => void) | null = null;
  return {
    AppState: {
      addEventListener: jest.fn((_event: string, next: (state: string) => void) => {
        handler = next;
        return { remove: jest.fn() };
      }),
      __emit: (state: string) => handler?.(state),
    },
  };
});

function makeTrack(id = 'track-1', durationMs = 200_000): Track {
  return {
    id,
    slug: id,
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    genre: 'electronic',
    mood: 'chill',
    bpm: 120,
    durationMs,
    coverUrl: null,
    license: null,
    licenseUrl: null,
    attribution: null,
    source: 'catalog',
    isPlayable: true,
    audioUrl: null,
    audioKey: `catalog/${id}.mp3`,
    isrc: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function createClient(opts?: {
  userId?: string | null;
  insertError?: unknown;
  updateError?: unknown;
  insertId?: number;
}) {
  const single = jest.fn().mockResolvedValue(
    opts?.insertError
      ? { data: null, error: opts.insertError }
      : { data: { id: opts?.insertId ?? 42 }, error: null },
  );
  const select = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select }));
  const updateEq = jest.fn().mockResolvedValue({ error: opts?.updateError ?? null });
  const update = jest.fn(() => ({ eq: updateEq }));
  const from = jest.fn(() => ({ insert, update }));
  const client = {
    auth: {
      getSession: jest.fn().mockResolvedValue(
        opts?.userId === null
          ? { data: { session: null }, error: null }
          : { data: { session: { user: { id: opts?.userId ?? 'user-1' } } }, error: null },
      ),
    },
    from,
  };
  return { client, from, insert, select, single, update, updateEq };
}

const getSupabaseMock = getSupabase as jest.MockedFunction<typeof getSupabase>;
const getItemMock = AsyncStorage.getItem as jest.Mock;
const setItemMock = AsyncStorage.setItem as jest.Mock;
const removeItemMock = AsyncStorage.removeItem as jest.Mock;
const appStateMock = AppState as typeof AppState & { __emit: (state: string) => void };

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-17T12:00:00Z'));
  getSupabaseMock.mockReset();
  getItemMock.mockReset().mockResolvedValue(null);
  setItemMock.mockReset().mockResolvedValue(undefined);
  removeItemMock.mockReset().mockResolvedValue(undefined);
  (AppState.addEventListener as jest.Mock).mockClear();
  await __resetScrobbleStateForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isCompleted', () => {
  it('is true at 50% of duration', () => {
    expect(isCompleted(100_000, 200_000)).toBe(true);
  });

  it('is true at 30 seconds for long tracks', () => {
    expect(isCompleted(30_000, 10_000_000)).toBe(true);
  });

  it('is false below both thresholds', () => {
    expect(isCompleted(29_999, 200_000)).toBe(false);
  });

  it('treats short tracks by whichever threshold is reachable', () => {
    expect(isCompleted(5_000, 6_000)).toBe(true);
    expect(isCompleted(2_999, 6_000)).toBe(false);
  });

  it('handles invalid or unknown duration safely', () => {
    expect(isCompleted(0, 0)).toBe(false);
    expect(isCompleted(30_000, -1)).toBe(true);
    expect(isCompleted(10_000, Number.NaN)).toBe(false);
  });
});

describe('scrobble lifecycle', () => {
  it('inserts a play row for the authenticated user', async () => {
    const { client, insert } = createClient();
    getSupabaseMock.mockReturnValue(client as never);

    await startScrobble(makeTrack(), 'history');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        track_id: 'track-1',
        context_type: 'history',
        ms_played: 0,
        completed: false,
      }),
    );
  });

  it('is a safe no-op without an authenticated session', async () => {
    const { client, from } = createClient({ userId: null });
    getSupabaseMock.mockReturnValue(client as never);

    await expect(startScrobble(makeTrack(), 'search')).resolves.toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it('throttles progress updates to 10 seconds and updates on pause/finish/background', async () => {
    const { client, update, updateEq } = createClient();
    getSupabaseMock.mockReturnValue(client as never);

    await startScrobble(makeTrack(), 'album');
    await onPlaybackProgress(5_000, 200_000);
    expect(update).not.toHaveBeenCalled();

    await onPlaybackProgress(10_000, 200_000);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ ms_played: 10_000, completed: false }));

    await onPlaybackProgress(15_000, 200_000);
    expect(update).toHaveBeenCalledTimes(1);

    await onPause(15_500, 200_000);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ ms_played: 15_500 }));

    await onPlaybackProgress(100_000, 200_000);
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ ms_played: 100_000, completed: true }));

    await onAppBackground();
    expect(update).toHaveBeenCalledTimes(4);
    expect(updateEq).toHaveBeenCalledWith('id', 42);
  });

  it('persists completion when finishing past the threshold', async () => {
    const { client, update } = createClient();
    getSupabaseMock.mockReturnValue(client as never);

    await startScrobble(makeTrack(), 'playlist');
    await onTrackFinished(120_000, 200_000);

    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ ms_played: 120_000, completed: true, ended_at: expect.any(String) }),
    );
  });
});

describe('offline queue and flush', () => {
  it('queues a failed insert and replays it on flush', async () => {
    const failing = createClient({ insertError: { message: 'offline' } });
    getSupabaseMock.mockReturnValueOnce(failing.client as never);

    await expect(startScrobble(makeTrack(), 'history')).resolves.toBeUndefined();
    expect(setItemMock).toHaveBeenCalled();

    const stored = JSON.parse(setItemMock.mock.calls[setItemMock.mock.calls.length - 1][1] as string);
    expect(stored).toHaveLength(1);
    getItemMock.mockResolvedValueOnce(JSON.stringify(stored));

    const ok = createClient({ insertId: 77 });
    getSupabaseMock.mockReturnValueOnce(ok.client as never);
    await flushPendingScrobbles();

    expect(ok.insert).toHaveBeenCalledWith(expect.objectContaining({ track_id: 'track-1', user_id: 'user-1' }));
    expect(removeItemMock).toHaveBeenCalled();
  });

  it('never throws playback paths on db/config failures', async () => {
    getSupabaseMock.mockImplementation(() => {
      throw new Error('not configured');
    });

    await expect(startScrobble(makeTrack(), 'history')).resolves.toBeUndefined();
    await expect(onPlaybackProgress(10_000, 200_000)).resolves.toBeUndefined();
    await expect(onPause(10_000, 200_000)).resolves.toBeUndefined();
    await expect(onAppBackground()).resolves.toBeUndefined();
    await expect(flushPendingScrobbles()).resolves.toBeUndefined();
  });
});

describe('app state integration', () => {
  it('registers an AppState listener for background updates', async () => {
    const { client } = createClient();
    getSupabaseMock.mockReturnValue(client as never);

    await startScrobble(makeTrack(), 'history');
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    appStateMock.__emit('inactive');
    await Promise.resolve();
  });
});
