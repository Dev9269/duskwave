import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePlayerStore } from '@/features/player/player-store';
import { colors, radii, spacing } from './tokens';
import { Text } from './primitives/text';

export function PlayerBar() {
  const { queue, currentTrack, isPlaying, positionMs, durationMs, toggle, next } = usePlayerStore();
  const isEmpty = queue.length === 0;
  const canControl = !isEmpty;

  const progress =
    durationMs > 0 ? Math.min(Math.max(positionMs / durationMs, 0), 1) : 0;

  const openPlayer = () => {
    if (!isEmpty) router.push('/player');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isEmpty ? 'No track playing' : `Now playing ${currentTrack?.title ?? 'track'}`}
      disabled={isEmpty}
      onPress={openPlayer}
      style={({ pressed }) => [styles.wrapper, pressed && !isEmpty && styles.pressed]}
    >
      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.bar}>
        {currentTrack?.coverUrl ? (
          <Image source={{ uri: currentTrack.coverUrl }} style={styles.art} contentFit="cover" />
        ) : (
          <View style={[styles.art, styles.artPlaceholder]}>
            <Ionicons name="musical-notes" size={18} color={colors.accent} />
          </View>
        )}
        <View style={styles.meta}>
          <Text variant="label" numberOfLines={1}>
            {currentTrack?.title ?? 'Nothing playing'}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {currentTrack?.artist ?? 'Pick a track to start listening'}
          </Text>
        </View>
        <View style={styles.transport}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            hitSlop={8}
            disabled={!canControl}
            onPress={(e) => {
              e.stopPropagation();
              toggle();
            }}
            style={({ pressed }) => [styles.iconButton, pressed && canControl && styles.iconPressed]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={canControl ? colors.text : colors.textFaint}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next track"
            hitSlop={8}
            disabled={!canControl}
            onPress={(e) => {
              e.stopPropagation();
              next();
            }}
            style={({ pressed }) => [styles.iconButton, pressed && canControl && styles.iconPressed]}
          >
            <Ionicons
              name="play-skip-forward"
              size={20}
              color={canControl ? colors.text : colors.textFaint}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  progressTrack: {
    height: 2,
    backgroundColor: colors.hairline,
    width: '100%',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.accent,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  art: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 2 },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconPressed: { backgroundColor: colors.surface },
});