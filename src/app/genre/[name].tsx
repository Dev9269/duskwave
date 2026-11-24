import { useLocalSearchParams } from 'expo-router';

import { DetailView } from '@/features/catalog/components/detail-view';
import { useGenreDetail } from '@/features/catalog/hooks';

function decodeName(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function GenreDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const genreName = decodeName(name);
  const detail = useGenreDetail(genreName);

  return (
    <DetailView
      eyebrow="GENRE"
      title={genreName || 'Genre'}
      subtitle="Picks from the Creative Commons catalog"
      tracks={detail.data?.tracks}
      loading={detail.isLoading}
      error={detail.error}
      emptyTitle="No tracks for this genre yet"
      emptyBody="Try another browse category."
      context="search"
    />
  );
}
