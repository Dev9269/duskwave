import { getFreshTracks, getLikedTracks, type Track } from './api';
import { buildTasteProfile, rankRecommendations } from './recommendations';

export type RecommendationSources = {
  liked: () => Promise<Track[]>;
  candidates: () => Promise<Track[]>;
};

const DEFAULT_SOURCES: RecommendationSources = {
  liked: () => getLikedTracks(),
  candidates: () => getFreshTracks(50),
};

export async function getRecommendedTracks(
  limit: number,
  sources: RecommendationSources = DEFAULT_SOURCES,
): Promise<Track[]> {
  const [liked, candidates] = await Promise.all([sources.liked(), sources.candidates()]);
  return rankRecommendations(candidates, buildTasteProfile(liked), limit);
}
