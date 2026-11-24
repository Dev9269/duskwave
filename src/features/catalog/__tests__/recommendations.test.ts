import type { Track } from '../api';
import { getRecommendedTracks } from '../recommendation-api';
import {
  buildTasteProfile,
  rankRecommendations,
  scoreTrack,
} from '../recommendations';

jest.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is not configured for this test.');
  },
}));

function makeTrack(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    slug: id,
    title: `Track ${id}`,
    artist: 'Artist',
    album: null,
    genre: 'ambient',
    mood: 'chill',
    bpm: 90,
    durationMs: 180_000,
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
    ...overrides,
  };
}

describe('buildTasteProfile', () => {
  it('counts genres and moods and derives a BPM range from liked tracks', () => {
    const profile = buildTasteProfile([
      makeTrack('a', { genre: 'ambient', mood: 'chill', bpm: 90 }),
      makeTrack('b', { genre: 'ambient', mood: 'chill', bpm: 100 }),
      makeTrack('c', { genre: 'jazz', mood: 'focus', bpm: 120 }),
    ]);

    expect(profile.genres.get('ambient')).toBe(2);
    expect(profile.genres.get('jazz')).toBe(1);
    expect(profile.moods.get('chill')).toBe(2);
    expect(profile.bpmRange).toEqual([90, 120]);
    expect(profile.excludedTrackIds.has('a')).toBe(true);
  });
});

describe('scoreTrack', () => {
  it('ranks a candidate with matching genre and mood above an unrelated one', () => {
    const profile = buildTasteProfile([
      makeTrack('liked', { genre: 'ambient', mood: 'chill', bpm: 95 }),
    ]);

    const matching = scoreTrack(
      makeTrack('match', { genre: 'ambient', mood: 'chill', bpm: 96 }),
      profile,
    );
    const unrelated = scoreTrack(
      makeTrack('other', { genre: 'metal', mood: 'energy', bpm: 180 }),
      profile,
    );

    expect(matching).toBeGreaterThan(unrelated);
  });
});

describe('getRecommendedTracks', () => {
  it('ranks candidates from the supplied providers and drops liked tracks', async () => {
    const liked = [makeTrack('liked', { genre: 'ambient', mood: 'chill', bpm: 95 })];
    const candidates = [
      makeTrack('liked'),
      makeTrack('match', { genre: 'ambient', mood: 'chill' }),
      makeTrack('other', { genre: 'jazz', mood: 'focus' }),
    ];

    const result = await getRecommendedTracks(2, {
      liked: async () => liked,
      candidates: async () => candidates,
    });

    expect(result.map((track) => track.id)).toEqual(['match', 'other']);
  });
});

describe('rankRecommendations', () => {
  it('excludes tracks already in the taste profile and caps the result', () => {
    const profile = buildTasteProfile([
      makeTrack('liked', { genre: 'ambient', mood: 'chill', bpm: 95 }),
    ]);
    const candidates = [
      makeTrack('liked'),
      makeTrack('one', { genre: 'ambient', mood: 'chill' }),
      makeTrack('two', { genre: 'jazz', mood: 'focus' }),
      makeTrack('three', { genre: 'metal', mood: 'energy' }),
    ];

    const result = rankRecommendations(candidates, profile, 2);

    expect(result.map((track) => track.id)).toEqual(['one', 'two']);
  });
});
