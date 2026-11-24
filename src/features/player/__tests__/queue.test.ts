import type { Track } from '@/features/catalog/api';

import {
  clampQueueIndex,
  getNextQueueIndex,
  getPreviousQueueIndex,
  replaceQueue,
} from '../player-store';

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

describe('clampQueueIndex', () => {
  it('clamps negative indexes to the first track', () => {
    expect(clampQueueIndex(-3, 3)).toBe(0);
  });

  it('clamps indexes past the end to the last track', () => {
    expect(clampQueueIndex(9, 3)).toBe(2);
  });

  it('truncates fractional indexes', () => {
    expect(clampQueueIndex(1.9, 3)).toBe(1);
  });

  it('returns 0 for an empty queue', () => {
    expect(clampQueueIndex(4, 0)).toBe(0);
  });
});

describe('getNextQueueIndex', () => {
  it('advances to the next track', () => {
    expect(getNextQueueIndex(0, 3)).toBe(1);
  });

  it('stays on the last track at the end without wrap', () => {
    expect(getNextQueueIndex(2, 3)).toBe(2);
  });

  it('keeps a single track at index 0 without wrap', () => {
    expect(getNextQueueIndex(0, 1)).toBe(0);
  });

  it('returns 0 for an empty queue', () => {
    expect(getNextQueueIndex(0, 0)).toBe(0);
  });

  it('wraps from the last track to the first with wrap', () => {
    expect(getNextQueueIndex(2, 3, true)).toBe(0);
  });

  it('keeps a single track at index 0 with wrap', () => {
    expect(getNextQueueIndex(0, 1, true)).toBe(0);
  });
});

describe('getPreviousQueueIndex', () => {
  it('moves to the previous track', () => {
    expect(getPreviousQueueIndex(2, 3)).toBe(1);
  });

  it('stays on the first track at the start without wrap', () => {
    expect(getPreviousQueueIndex(0, 3)).toBe(0);
  });

  it('keeps a single track at index 0 without wrap', () => {
    expect(getPreviousQueueIndex(0, 1)).toBe(0);
  });

  it('returns 0 for an empty queue', () => {
    expect(getPreviousQueueIndex(0, 0)).toBe(0);
  });

  it('wraps from the first track to the last with wrap', () => {
    expect(getPreviousQueueIndex(0, 3, true)).toBe(2);
  });

  it('keeps a single track at index 0 with wrap', () => {
    expect(getPreviousQueueIndex(0, 1, true)).toBe(0);
  });
});

describe('replaceQueue', () => {
  it('replaces the queue, resets position and duration, and exposes the current track', () => {
    const replacement = replaceQueue(tracks, 1, 'search');

    expect(replacement.queue).toEqual(tracks);
    expect(replacement.index).toBe(1);
    expect(replacement.context).toBe('search');
    expect(replacement.positionMs).toBe(0);
    expect(replacement.durationMs).toBe(0);
    expect(replacement.currentTrack).toBe(tracks[1]);
  });

  it('clamps a start index past the end to the last track', () => {
    const replacement = replaceQueue(tracks, 99, 'album');

    expect(replacement.index).toBe(2);
    expect(replacement.currentTrack).toBe(tracks[2]);
  });

  it('clamps a negative start index to the first track', () => {
    const replacement = replaceQueue(tracks, -4, 'liked');

    expect(replacement.index).toBe(0);
    expect(replacement.currentTrack).toBe(tracks[0]);
  });

  it('resets to an empty queue safely', () => {
    const replacement = replaceQueue([], 3, 'history');

    expect(replacement.queue).toEqual([]);
    expect(replacement.index).toBe(0);
    expect(replacement.context).toBe('history');
    expect(replacement.positionMs).toBe(0);
    expect(replacement.durationMs).toBe(0);
    expect(replacement.currentTrack).toBeNull();
  });

  it('does not mutate the provided queue', () => {
    const source = [...tracks];

    replaceQueue(source, 0, 'playlist');

    expect(source).toEqual(tracks);
  });
});
