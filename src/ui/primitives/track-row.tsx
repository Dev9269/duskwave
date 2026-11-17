import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { formatDuration } from '@/lib/format';

import { colors, radii, spacing } from '../tokens';
import { Text } from './text';

export type TrackRowProps = {
  title: string;
  artist: string;
  artworkUrl?: string | null;
  durationMs?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  trailing?: React.ReactNode;
  style?: ViewStyle;
};

export function TrackRow({
  title,
  artist,
  artworkUrl,
  durationMs,
  onPress,
  onLongPress,
  trailing,
  style,
}: TrackRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} by ${artist}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.artwork} contentFit="cover" />
      ) : (
        <View style={[styles.artwork, styles.placeholder]} />
      )}
      <View style={styles.meta}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {artist}
        </Text>
      </View>
      {durationMs ? (
        <Text variant="caption" muted>
          {formatDuration(durationMs)}
        </Text>
      ) : null}
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  artwork: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised },
  placeholder: { borderWidth: 1, borderColor: colors.hairline },
  meta: { flex: 1, gap: 2 },
});
