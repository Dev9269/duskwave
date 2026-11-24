import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTrackLike } from '@/features/catalog/use-track-like';
import { usePlayerStore } from '@/features/player/player-store';
import { colors, radii, spacing } from './tokens';
import { Text } from './primitives/text';

export function PlayerBar() {
  const { queue, currentTrack, isPlaying, positionMs, durationMs, toggle } = usePlayerStore();
  const isEmpty = queue.length === 0;
  const canControl = !isEmpty;
  const like = useTrackLike(currentTrack?.id ?? null);
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isEmpty) return;

    appear.setValue(0);
    const animation = Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [appear, isEmpty]);

  const progress = durationMs > 0 ? Math.min(Math.max(positionMs / durationMs, 0), 1) : 0;

  const openPlayer = () => {
    if (!isEmpty) router.push('/player');
  };

  if (isEmpty) return null;

  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [
          {
            translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Now playing ${currentTrack?.title ?? 'track'}`}
        onPress={openPlayer}
        style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
      >
        <View style={styles.progressTrack} pointerEvents="none">
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.bar}>
          {currentTrack?.coverUrl ? (
            <Image source={{ uri: currentTrack.coverUrl }} style={styles.art} contentFit="cover" />
          ) : (
            <View style={[styles.art, styles.artPlaceholder]}>
              <Ionicons name="musical-notes" size={18} color={colors.textMuted} />
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
              accessibilityLabel={like.liked ? 'Unlike track' : 'Like track'}
              accessibilityState={{ selected: like.liked, disabled: !like.canLike }}
              hitSlop={8}
              disabled={!like.canLike}
              onPress={(event) => {
                event.stopPropagation();
                void like.toggle();
              }}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && like.canLike && styles.iconPressed,
              ]}
            >
              <Ionicons
                name={like.liked ? 'heart' : 'heart-outline'}
                size={20}
                color={like.liked ? colors.accent : like.canLike ? colors.text : colors.textFaint}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              hitSlop={8}
              disabled={!canControl}
              onPress={(event) => {
                event.stopPropagation();
                toggle();
              }}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && canControl && styles.iconPressed,
              ]}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color={canControl ? colors.text : colors.textFaint}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function PlayerDock() {
  const hasQueue = usePlayerStore((state) => state.queue.length > 0);

  if (!hasQueue) return null;

  return (
    <View style={styles.dock}>
      <PlayerBar />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.ink,
  },
  wrapper: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  pressed: { opacity: 0.92 },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.text,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  art: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.elevated,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 1 },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconPressed: { backgroundColor: colors.elevated },
});
