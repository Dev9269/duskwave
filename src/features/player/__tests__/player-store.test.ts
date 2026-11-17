import type { Track } from '@/features/catalog/api';

import { resolveAudioUrl } from '../audio-source';
import { destroyEngine } from '../engine';
import { usePlayerStore } from '../player-store';

jest.mock('../audio-source', () => ({
  resolveAudioUrl: jest.fn(),
}));

const resolveAudioUrlMock = resolveAudioUrl as jest.MockedFunction<typeof resolveAudioUrl>;

type MockLockScreen = { active: boolean; metadata?: Record<string, unknown> } | null;

type MockPlaylist = {
  sources: unknown[];
  currentIndex: number;
  currentTime: number;
  playing: boolean;
  lockScreen: MockLockScreen;
  destroyed: boolean;
  calls: {
    play: number;
    pause: number;
    add: unknown[];
    clear: number;
    skipTo: (number | string)[];
    seekTo: number[];
    setActiveForLockScreen: {
      active: boolean;
      metadata?: Record<string, unknown>;
    }[];
    updateLockScreenMetadata: Record<string, unknown>[];
    destroy: number;
  };
  __emitStatus: (overrides?: Record<string, unknown>) => void;
  __emitTrackChanged: (previousIndex: number, currentIndex: number) => void;
};

type ExpoAudioMock = {
  playlists: MockPlaylist[];
  setAudioModeAsync: jest.Mock;
  createAudioPlaylist: jest.Mock;
  reset: () => void;
};

function getAudioMock(): ExpoAudioMock {
  return (jest.requireMock('expo-audio') as { __audioMock: ExpoAudioMock }).__audioMock;
}

function makeTrack(id: string): Track {
  return {
    id,
    slug: id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    album: 'Test Album',
    genre: 'test',
    mood: 'mellow',
    bpm: 100,
    durationMs: 180_000,
    coverUrl: null,
    license: 'CC BY',
    licenseUrl: 'https://example.com/license',
    attribution: 'Test Artist',
    source: 'catalog',
    isPlayable: true,
    audioUrl: null,
    audioKey: `catalog/${id}.mp3`,
    isrc: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')];

function sourceFor(track: Pick<Track, 'audioKey'>): string {
  return `https://audio.test/${track.audioKey}`;
}

function latestPlaylist(): MockPlaylist {
  const { playlists } = getAudioMock();
  expect(playlists.length).toBeGreaterThan(0);
  return playlists[playlists.length - 1];
}

const EMPTY_STATE = {
  queue: [],
  index: 0,
  context: 'history' as const,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  currentTrack: null,
  error: null,
};

beforeEach(() => {
  destroyEngine();
  const audioMock = getAudioMock();
  audioMock.reset();
  resolveAudioUrlMock.mockReset();
  resolveAudioUrlMock.mockImplementation(async (track) => sourceFor(track));
  usePlayerStore.setState(EMPTY_STATE);
});

afterEach(() => {
  destroyEngine();
});

describe('playQueue', () => {
  it('loads a source-resolved queue and starts playback', async () => {
    await usePlayerStore.getState().playQueue(tracks, 1, 'search');

    const state = usePlayerStore.getState();
    const playlist = latestPlaylist();

    expect(state.queue).toEqual(tracks);
    expect(state.index).toBe(1);
    expect(state.context).toBe('search');
    expect(state.currentTrack).toBe(tracks[1]);
    expect(state.isPlaying).toBe(true);
    expect(state.error).toBeNull();
    expect(playlist.sources).toEqual(tracks.map(sourceFor));
    expect(playlist.currentIndex).toBe(1);
    expect(playlist.playing).toBe(true);
    expect(playlist.calls.skipTo).toEqual([1]);
    expect(getAudioMock().setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    expect(playlist.lockScreen?.active).toBe(true);
    expect(playlist.lockScreen?.metadata).toMatchObject({
      title: 'Track b',
      artist: 'Test Artist',
      albumTitle: 'Test Album',
    });
  });

  it('clamps an out-of-range start index before skipping', async () => {
    await usePlayerStore.getState().playQueue(tracks, 99, 'album');

    expect(usePlayerStore.getState().index).toBe(2);
    expect(latestPlaylist().calls.skipTo).toEqual([2]);
    expect(latestPlaylist().lockScreen?.metadata).toMatchObject({ title: 'Track c' });
  });

  it('clears the engine when the queue is empty', async () => {
    await usePlayerStore.getState().playQueue(tracks, 1, 'search');
    const playlist = latestPlaylist();

    await usePlayerStore.getState().playQueue([], 0, 'history');

    const state = usePlayerStore.getState();
    expect(state.queue).toEqual([]);
    expect(state.index).toBe(0);
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.positionMs).toBe(0);
    expect(state.durationMs).toBe(0);
    expect(playlist.playing).toBe(false);
    expect(playlist.sources).toEqual([]);
    expect(playlist.calls.clear).toBeGreaterThan(0);
    expect(playlist.lockScreen?.active).toBe(false);
  });

  it('surfaces a source resolution failure and leaves playback stopped', async () => {
    resolveAudioUrlMock.mockRejectedValueOnce(new Error('boom'));

    await usePlayerStore.getState().playQueue([tracks[0]], 0, 'search');

    const state = usePlayerStore.getState();
    expect(state.error).toBe('boom');
    expect(state.isPlaying).toBe(false);
    expect(state.queue).toEqual([tracks[0]]);
    expect(state.currentTrack).toBe(tracks[0]);
    expect(getAudioMock().playlists).toEqual([]);
  });

  it('ignores a superseded load when a newer queue replaces it', async () => {
    let releaseFirst: ((url: string) => void) | undefined;

    resolveAudioUrlMock.mockImplementation((track) => {
      if (track.audioKey === tracks[0].audioKey) {
        return new Promise<string>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve(sourceFor(track));
    });

    const firstLoad = usePlayerStore.getState().playQueue([tracks[0]], 0, 'album');
    await Promise.resolve();
    await usePlayerStore.getState().playQueue([tracks[1]], 0, 'search');

    releaseFirst?.(sourceFor(tracks[0]));
    await firstLoad;

    const state = usePlayerStore.getState();
    expect(state.queue).toEqual([tracks[1]]);
    expect(state.index).toBe(0);
    expect(state.currentTrack).toBe(tracks[1]);
    expect(latestPlaylist().sources).toEqual([sourceFor(tracks[1])]);
  });

  it('configures the audio mode only once across loads', async () => {
    await usePlayerStore.getState().playQueue([tracks[0]], 0, 'search');
    await usePlayerStore.getState().playQueue([tracks[1]], 0, 'search');

    expect(getAudioMock().setAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  it('retries the audio mode configuration after a failure', async () => {
    getAudioMock().setAudioModeAsync.mockRejectedValueOnce(new Error('audio mode unavailable'));

    await usePlayerStore.getState().playQueue([tracks[0]], 0, 'search');
    expect(usePlayerStore.getState().error).toBe('audio mode unavailable');

    await usePlayerStore.getState().playQueue([tracks[0]], 0, 'search');

    expect(usePlayerStore.getState().error).toBeNull();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(getAudioMock().setAudioModeAsync).toHaveBeenCalledTimes(2);
  });
});

describe('transport controls', () => {
  it('toggles between playing and paused', async () => {
    await usePlayerStore.getState().playQueue(tracks, 0, 'search');
    const playlist = latestPlaylist();

    usePlayerStore.getState().toggle();

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(playlist.calls.pause).toBe(1);

    usePlayerStore.getState().toggle();

    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(playlist.calls.play).toBe(2);
  });

  it('moves to the next and previous tracks without wrapping', async () => {
    await usePlayerStore.getState().playQueue(tracks, 0, 'search');
    const playlist = latestPlaylist();

    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().index).toBe(1);
    expect(usePlayerStore.getState().currentTrack).toBe(tracks[1]);

    usePlayerStore.getState().next();
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().index).toBe(2);

    usePlayerStore.getState().previous();
    expect(usePlayerStore.getState().index).toBe(1);
    expect(playlist.calls.skipTo).toEqual([0, 1, 2, 1]);
  });

  it('seeks within the loaded track duration', async () => {
    await usePlayerStore.getState().playQueue(tracks, 0, 'search');
    const playlist = latestPlaylist();
    playlist.__emitStatus({ currentTime: 0, duration: 30.5, playing: true });

    await usePlayerStore.getState().seek(12_345);
    expect(playlist.calls.seekTo).toEqual([12.345]);
    expect(usePlayerStore.getState().positionMs).toBe(12_345);

    await usePlayerStore.getState().seek(-250);
    expect(playlist.calls.seekTo).toEqual([12.345, 0]);
    expect(usePlayerStore.getState().positionMs).toBe(0);

    await usePlayerStore.getState().seek(99_000);
    expect(playlist.calls.seekTo).toEqual([12.345, 0, 30.5]);
    expect(usePlayerStore.getState().positionMs).toBe(30_500);
  });

  it('does nothing when controlling an empty queue', async () => {
    usePlayerStore.getState().toggle();
    usePlayerStore.getState().next();
    usePlayerStore.getState().previous();
    await usePlayerStore.getState().seek(5_000);

    const state = usePlayerStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.queue).toEqual([]);
    expect(state.positionMs).toBe(0);
    expect(getAudioMock().playlists).toEqual([]);
  });
});

describe('queue updates', () => {
  it('appends a source-resolved track while keeping the current track', async () => {
    await usePlayerStore.getState().playQueue([tracks[0]], 0, 'search');
    const playlist = latestPlaylist();

    await usePlayerStore.getState().appendToQueue(tracks[1]);

    const state = usePlayerStore.getState();
    expect(state.queue).toEqual([tracks[0], tracks[1]]);
    expect(state.currentTrack).toBe(tracks[0]);
    expect(playlist.sources).toEqual([sourceFor(tracks[0]), sourceFor(tracks[1])]);
  });

  it('appends to an empty player without starting playback', async () => {
    await usePlayerStore.getState().appendToQueue(tracks[0]);

    const state = usePlayerStore.getState();
    expect(state.queue).toEqual([tracks[0]]);
    expect(state.index).toBe(0);
    expect(state.currentTrack).toBe(tracks[0]);
    expect(state.isPlaying).toBe(false);

    const playlist = latestPlaylist();
    expect(playlist.sources).toEqual([sourceFor(tracks[0])]);
    expect(playlist.calls.play).toBe(0);
    expect(playlist.lockScreen).toBeNull();
  });

  it('surfaces an append failure without changing the queue', async () => {
    await usePlayerStore.getState().playQueue([tracks[0]], 0, 'search');
    resolveAudioUrlMock.mockRejectedValueOnce(new Error('append failed'));

    await usePlayerStore.getState().appendToQueue(tracks[1]);

    const state = usePlayerStore.getState();
    expect(state.queue).toEqual([tracks[0]]);
    expect(state.error).toBe('append failed');
  });
});

describe('engine events', () => {
  it('mirrors playlist status as integer milliseconds', async () => {
    await usePlayerStore.getState().playQueue(tracks, 0, 'search');
    const playlist = latestPlaylist();

    playlist.__emitStatus({ currentTime: 12.345, duration: 30.678, playing: true });

    expect(usePlayerStore.getState().positionMs).toBe(12_345);
    expect(usePlayerStore.getState().durationMs).toBe(30_678);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    playlist.__emitStatus({ currentTime: 12.4, playing: false });

    expect(usePlayerStore.getState().positionMs).toBe(12_400);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('follows track changes and refreshes lock screen metadata', async () => {
    await usePlayerStore.getState().playQueue(tracks, 0, 'search');
    const playlist = latestPlaylist();

    playlist.__emitTrackChanged(0, 2);

    const state = usePlayerStore.getState();
    expect(state.index).toBe(2);
    expect(state.currentTrack).toBe(tracks[2]);
    expect(state.positionMs).toBe(0);
    expect(state.durationMs).toBe(0);
    expect(playlist.calls.updateLockScreenMetadata[0]).toMatchObject({ title: 'Track c' });
  });
});
