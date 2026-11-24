import type { Track } from './api';

export type TasteProfile = {
  genres: Map<string, number>;
  moods: Map<string, number>;
  bpmRange: [number, number] | null;
  excludedTrackIds: Set<string>;
};

function normalize(value: string | null): string | null {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function buildTasteProfile(tracks: Track[]): TasteProfile {
  const genres = new Map<string, number>();
  const moods = new Map<string, number>();
  const excludedTrackIds = new Set<string>();
  const bpms: number[] = [];

  for (const track of tracks) {
    excludedTrackIds.add(track.id);

    const genre = normalize(track.genre);
    if (genre) genres.set(genre, (genres.get(genre) ?? 0) + 1);

    const mood = normalize(track.mood);
    if (mood) moods.set(mood, (moods.get(mood) ?? 0) + 1);

    if (typeof track.bpm === 'number' && Number.isFinite(track.bpm)) bpms.push(track.bpm);
  }

  return {
    genres,
    moods,
    bpmRange: bpms.length > 0 ? [Math.min(...bpms), Math.max(...bpms)] : null,
    excludedTrackIds,
  };
}

export function scoreTrack(track: Track, profile: TasteProfile): number {
  let score = 0;

  const genre = normalize(track.genre);
  if (genre) score += (profile.genres.get(genre) ?? 0) * 3;

  const mood = normalize(track.mood);
  if (mood) score += (profile.moods.get(mood) ?? 0) * 2;

  if (profile.bpmRange && typeof track.bpm === 'number' && Number.isFinite(track.bpm)) {
    const [low, high] = profile.bpmRange;
    if (track.bpm >= low - 10 && track.bpm <= high + 10) score += 1;
  }

  return score;
}

export function rankRecommendations(
  candidates: Track[],
  profile: TasteProfile,
  limit: number,
): Track[] {
  const size = Math.max(0, Math.trunc(limit));

  return candidates
    .map((track, index) => ({ track, index, score: scoreTrack(track, profile) }))
    .filter(({ track }) => track.isPlayable && !profile.excludedTrackIds.has(track.id))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, size)
    .map(({ track }) => track);
}
