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
  badge?: string;
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
  badge,
  onPress,
  onLongPress,
  trailing,
  style,
}: TrackRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} by ${artist}${badge ? `, ${badge}` : ''}`}
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
      {badge ? (
        <View style={styles.badge}>
          <Text variant="caption" muted>
            {badge}
          </Text>
        </View>
      ) : null}
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
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  artwork: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised },
  placeholder: { borderWidth: 1, borderColor: colors.hairline },
  meta: { flex: 1, gap: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
});
