import {
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioMetadata,
  type AudioMode,
  type AudioPlaylist,
  type AudioPlaylistStatus,
} from 'expo-audio';

import type { Track } from '@/features/catalog/api';

import { resolveAudioUrl } from './audio-source';

export type PlaybackSnapshot = {
  currentIndex: number;
  trackCount: number;
  currentTime: number;
  duration: number;
  playing: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
};

export type TrackChange = {
  previousIndex: number;
  currentIndex: number;
};

export type EngineHandlers = {
  onStatus?: (status: PlaybackSnapshot) => void;
  onTrackChanged?: (trackChange: TrackChange) => void;
  onError?: (message: string) => void;
};

const AUDIO_MODE: Partial<AudioMode> = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
};

let handlers: EngineHandlers = {};
let playlist: AudioPlaylist | null = null;
let loadedTracks: Track[] = [];
let currentIndex = 0;
let loaded = false;
let loading = false;
let generation = 0;
let pendingSkipIndex: number | null = null;
let lockScreenActive = false;
let audioModePromise: Promise<void> | null = null;

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Playback failed.';
}

function reportError(error: unknown): void {
  handlers.onError?.(messageFrom(error));
}

function ensureAudioMode(): Promise<void> {
  if (!audioModePromise) {
    audioModePromise = setAudioModeAsync(AUDIO_MODE).catch((error) => {
      audioModePromise = null;
      throw error;
    });
  }
  return audioModePromise;
}

function metadataFor(track: Track | undefined): AudioMetadata {
  if (!track) return {};

  const metadata: AudioMetadata = {
    title: track.title,
    artist: track.artist,
  };
  if (track.album) metadata.albumTitle = track.album;
  if (track.coverUrl) metadata.artworkUrl = track.coverUrl;
  return metadata;
}

function deactivateLockScreen(): void {
  lockScreenActive = false;
  if (!playlist) return;

  try {
    playlist.setActiveForLockScreen(false);
  } catch (error) {
    reportError(error);
  }
}

function activateLockScreen(): void {
  if (!playlist) return;

  try {
    playlist.setActiveForLockScreen(true, metadataFor(loadedTracks[currentIndex]));
    lockScreenActive = true;
  } catch (error) {
    reportError(error);
  }
}

function updateLockScreen(): void {
  if (!lockScreenActive || !playlist) return;

  try {
    playlist.updateLockScreenMetadata(metadataFor(loadedTracks[currentIndex]));
  } catch (error) {
    reportError(error);
  }
}

function snapshotOf(active: AudioPlaylist): PlaybackSnapshot {
  return {
    currentIndex: active.currentIndex,
    trackCount: active.trackCount,
    currentTime: active.currentTime,
    duration: active.duration,
    playing: active.playing,
    isBuffering: active.isBuffering,
    isLoaded: active.isLoaded,
  };
}

function emitSnapshot(): void {
  if (!playlist) return;
  handlers.onStatus?.(snapshotOf(playlist));
}

function handleStatus(status: AudioPlaylistStatus): void {
  if (loading) return;

  handlers.onStatus?.({
    currentIndex: status.currentIndex,
    trackCount: status.trackCount,
    currentTime: status.currentTime,
    duration: status.duration,
    playing: status.playing,
    isBuffering: status.isBuffering,
    isLoaded: status.isLoaded,
  });
}

function handleTrackChanged(trackChange: TrackChange): void {
  if (loading) return;

  currentIndex = trackChange.currentIndex;
  updateLockScreen();
  handlers.onTrackChanged?.(trackChange);
}

function ensurePlaylist(): AudioPlaylist {
  if (playlist) return playlist;

  const created = createAudioPlaylist();
  created.addListener('playlistStatusUpdate', handleStatus);
  created.addListener('trackChanged', handleTrackChanged);
  playlist = created;
  return created;
}

export function setEngineHandlers(nextHandlers: EngineHandlers): void {
  handlers = nextHandlers;
}

export async function loadQueue(
  tracks: Track[],
  startIndex: number,
  options: { autoplay?: boolean } = {},
): Promise<boolean> {
  const autoplay = options.autoplay ?? true;
  const token = generation + 1;
  generation = token;
  loading = true;
  pendingSkipIndex = null;
  loaded = false;
  loadedTracks = [];
  currentIndex = 0;

  const active = playlist;
  if (active) {
    try {
      active.pause();
    } catch (error) {
      reportError(error);
    }
  }
  deactivateLockScreen();

  try {
    if (tracks.length === 0) {
      active?.clear();
      loaded = true;
      loading = false;
      emitSnapshot();
      return true;
    }

    const sources = await Promise.all(tracks.map((track) => resolveAudioUrl(track)));
    if (token !== generation) return false;

    await ensureAudioMode();
    if (token !== generation) return false;

    const target = ensurePlaylist();
    target.clear();
    for (const source of sources) target.add(source);

    loadedTracks = [...tracks];
    const requestedIndex = pendingSkipIndex ?? startIndex;
    const safeIndex = Number.isFinite(requestedIndex) ? Math.trunc(requestedIndex) : 0;
    currentIndex = Math.min(Math.max(safeIndex, 0), tracks.length - 1);
    pendingSkipIndex = null;
    target.skipTo(currentIndex);

    loaded = true;
    loading = false;

    if (autoplay) {
      target.play();
      activateLockScreen();
    }
    emitSnapshot();
    return true;
  } catch (error) {
    if (token !== generation) return false;

    loaded = false;
    loading = false;
    loadedTracks = [];
    currentIndex = 0;
    if (active) {
      try {
        active.pause();
        active.clear();
      } catch (cleanupError) {
        reportError(cleanupError);
      }
    }
    deactivateLockScreen();
    reportError(error);
    throw error;
  }
}

export function play(): boolean {
  if (!loaded || !playlist) return false;

  try {
    playlist.play();
  } catch (error) {
    reportError(error);
    return false;
  }
  activateLockScreen();
  return true;
}

export function pause(): boolean {
  if (!loaded || !playlist) return false;

  try {
    playlist.pause();
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
}

export function skipTo(index: number): boolean {
  if (loading) {
    pendingSkipIndex = index;
    return true;
  }
  if (!loaded || !playlist) return false;

  try {
    playlist.skipTo(index);
    currentIndex = index;
    updateLockScreen();
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
}

export async function seek(seconds: number): Promise<void> {
  if (!loaded || !playlist) return;

  try {
    await playlist.seekTo(seconds);
  } catch (error) {
    reportError(error);
    throw error;
  }
}

export async function appendTrack(track: Track): Promise<boolean> {
  if (!loaded) return false;

  const token = generation;
  const source = await resolveAudioUrl(track);
  if (token !== generation || !loaded) return false;

  const target = ensurePlaylist();
  try {
    target.add(source);
    loadedTracks = [...loadedTracks, track];
    return true;
  } catch (error) {
    reportError(error);
    throw error;
  }
}

export function clearQueue(): void {
  generation += 1;
  loading = false;
  loaded = false;
  loadedTracks = [];
  currentIndex = 0;
  pendingSkipIndex = null;

  if (playlist) {
    try {
      playlist.pause();
      playlist.clear();
    } catch (error) {
      reportError(error);
    }
  }
  deactivateLockScreen();
}

export function destroyEngine(): void {
  generation += 1;
  loading = false;
  loaded = false;
  loadedTracks = [];
  currentIndex = 0;
  pendingSkipIndex = null;
  lockScreenActive = false;
  audioModePromise = null;

  const active = playlist;
  playlist = null;
  if (!active) return;

  try {
    active.destroy();
  } catch (error) {
    reportError(error);
  }
}
