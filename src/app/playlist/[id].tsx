import { useLocalSearchParams } from 'expo-router';

import { DetailView } from '@/features/catalog/components/detail-view';
import { usePlaylistDetail } from '@/features/catalog/hooks';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  const detail = usePlaylistDetail(playlistId);
  const playlist = detail.data;

  return (
    <DetailView
      eyebrow="PLAYLIST"
      title={playlist?.title ?? 'Playlist'}
      subtitle={playlist?.description ?? undefined}
      coverUrl={playlist?.coverUrl}
      tracks={playlist?.tracks}
      loading={detail.isLoading}
      error={detail.error}
      emptyTitle="This playlist is empty"
      emptyBody="Add tracks from search to build this playlist."
      context="playlist"
    />
  );
}
