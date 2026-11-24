import { router, useLocalSearchParams } from 'expo-router';

import { DetailView } from '@/features/catalog/components/detail-view';
import { useAlbumDetail } from '@/features/catalog/hooks';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const albumId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  const detail = useAlbumDetail(albumId);
  const album = detail.data;

  return (
    <DetailView
      eyebrow="ALBUM"
      title={album?.title ?? 'Album'}
      subtitle={
        album
          ? `${album.artistName}${album.releaseYear ? ` · ${album.releaseYear}` : ''}`
          : undefined
      }
      coverUrl={album?.coverUrl}
      tracks={album?.tracks}
      loading={detail.isLoading}
      error={detail.error}
      emptyTitle="No playable tracks yet"
      emptyBody="This album has no playable catalog tracks."
      context="album"
      headerLink={
        album
          ? {
              label: album.artistName,
              onPress: () =>
                router.push({ pathname: '/artist/[id]', params: { id: album.artistId } }),
            }
          : undefined
      }
    />
  );
}
