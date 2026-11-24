import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DetailView } from '@/features/catalog/components/detail-view';
import { useArtistDetail } from '@/features/catalog/hooks';
import { Text, colors, radii, spacing } from '@/ui';

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artistId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  const detail = useArtistDetail(artistId);
  const artist = detail.data;

  return (
    <DetailView
      eyebrow="ARTIST"
      title={artist?.name ?? 'Artist'}
      subtitle={artist?.bio ?? undefined}
      coverUrl={artist?.imageUrl}
      tracks={artist?.tracks}
      loading={detail.isLoading}
      error={detail.error}
      emptyTitle="No playable tracks yet"
      emptyBody="This artist has no playable catalog tracks."
      context="album"
      extra={
        artist && artist.albums.length > 0 ? (
          <View style={styles.section}>
            <Text variant="heading">Albums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {artist.albums.map((album) => (
                <Pressable
                  key={album.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open album ${album.title}`}
                  onPress={() =>
                    router.push({ pathname: '/album/[id]', params: { id: album.id } })
                  }
                  style={styles.card}
                >
                  {album.coverUrl ? (
                    <Image source={{ uri: album.coverUrl }} style={styles.art} contentFit="cover" />
                  ) : (
                    <View style={[styles.art, styles.placeholder]} />
                  )}
                  <Text variant="label" numberOfLines={1}>
                    {album.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm },
  row: { gap: spacing.md },
  card: { width: 132, gap: spacing.xs },
  art: { width: 132, height: 132, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised },
  placeholder: { borderWidth: 1, borderColor: colors.hairline },
});
