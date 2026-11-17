import { useCallback, useEffect, useMemo, useState } from 'react';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { Track } from '@/features/catalog/api';
import { useSession } from '@/features/auth/session-provider';
import { usePlayerStore } from '@/features/player/player-store';
import { formatDuration } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/ui/tokens';
import { Text } from '@/ui/primitives/text';
import { TrackRow } from '@/ui/primitives/track-row';

function useTrackLike(trackId: string | null) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!trackId || !userId || !supabase) {
      void Promise.resolve().then(() => {
        if (active) setLiked(false);
      });
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('track_id')
          .eq('user_id', userId)
          .eq('track_id', trackId)
          .maybeSingle();
        if (!active) return;
        if (error) {
          setLiked(false);
          return;
        }
        setLiked(!!data);
      } catch {
        if (active) setLiked(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [trackId, userId]);

  const toggle = useCallback(async () => {
    if (!trackId || !userId || !supabase || busy) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setBusy(true);
    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: userId, track_id: trackId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', userId)
          .eq('track_id', trackId);
        if (error) throw error;
      }
    } catch {
      setLiked(!nextLiked);
    } finally {
      setBusy(false);
    }
  }, [busy, liked, trackId, userId]);

  const canLike = !!trackId && !!userId && !!supabase;
  return { liked, toggle, canLike, busy };
}

function QueueSheet({
  visible,
  onClose,
  queue,
  currentIndex,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  queue: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close queue" />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text variant="heading">Queue</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.sheetList}
            renderItem={({ item, index }) => {
              const active = index === currentIndex;
              return (
                <View style={[styles.queueItem, active && styles.queueItemActive]}>
                  <TrackRow
                    title={item.title}
                    artist={item.artist}
                    artworkUrl={item.coverUrl}
                    durationMs={item.durationMs}
                    onPress={() => onSelect(index)}
                    trailing={
                      active ? (
                        <Ionicons name="volume-high" size={16} color={colors.accent} />
                      ) : undefined
                    }
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <Text muted style={styles.sheetEmpty}>
                Queue is empty.
              </Text>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function PlayerScreen() {
  const { queue, index, context, currentTrack, isPlaying, positionMs, durationMs, toggle, next, previous, seek, playQueue } =
    usePlayerStore();
  const [queueOpen, setQueueOpen] = useState(false);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const like = useTrackLike(currentTrack?.id ?? null);

  const effectivePosition = scrubMs ?? positionMs;
  const safeDuration = durationMs > 0 ? durationMs : Math.max(currentTrack?.durationMs ?? 0, 1);

  const progressLabel = useMemo(
    () => `${formatDuration(effectivePosition)} / ${formatDuration(safeDuration)}`,
    [effectivePosition, safeDuration],
  );

  const openLicense = useCallback(async () => {
    const url = currentTrack?.licenseUrl;
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, [currentTrack?.licenseUrl]);

  if (!currentTrack || queue.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close player"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.iconCircle}
          >
            <Ionicons name="chevron-down" size={22} color={colors.text} />
          </Pressable>
          <Text variant="caption" muted style={styles.headerLabel}>
            NOW PLAYING
          </Text>
          <View style={styles.iconCircleSpacer} />
        </View>
        <View style={styles.emptyArt}>
          <Ionicons name="moon" size={64} color={colors.accent} />
        </View>
        <View style={styles.meta}>
          <Text variant="title">Nothing playing</Text>
          <Text muted>Pick a track to start listening.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close player"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.iconCircle}
          >
            <Ionicons name="chevron-down" size={22} color={colors.text} />
          </Pressable>
          <Text variant="caption" muted style={styles.headerLabel} numberOfLines={1}>
            {context.toUpperCase()}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open queue"
            hitSlop={12}
            onPress={() => setQueueOpen(true)}
            style={styles.iconCircle}
          >
            <Ionicons name="list" size={20} color={colors.text} />
          </Pressable>
        </View>

        {currentTrack.coverUrl ? (
          <Image source={{ uri: currentTrack.coverUrl }} style={styles.art} contentFit="cover" />
        ) : (
          <View style={[styles.art, styles.emptyArt]}>
            <Ionicons name="musical-notes" size={72} color={colors.accent} />
          </View>
        )}

        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text variant="title" numberOfLines={2}>
                {currentTrack.title}
              </Text>
              <Text muted numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={like.liked ? 'Unlike track' : 'Like track'}
              accessibilityState={{ selected: like.liked, disabled: !like.canLike }}
              disabled={!like.canLike}
              onPress={() => void like.toggle()}
              hitSlop={8}
              style={({ pressed }) => [styles.likeButton, pressed && like.canLike && styles.pressed]}
            >
              <Ionicons
                name={like.liked ? 'heart' : 'heart-outline'}
                size={26}
                color={like.liked ? colors.accent : like.canLike ? colors.text : colors.textFaint}
              />
            </Pressable>
          </View>

          {currentTrack.license ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open license ${currentTrack.license}`}
              disabled={!currentTrack.licenseUrl}
              onPress={() => void openLicense()}
              style={({ pressed }) => [
                styles.licenseChip,
                pressed && currentTrack.licenseUrl && styles.pressed,
                !currentTrack.licenseUrl && styles.licenseChipDisabled,
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.accent} />
              <Text variant="caption" accent numberOfLines={1}>
                {currentTrack.license}
              </Text>
              {currentTrack.licenseUrl ? (
                <Ionicons name="open-outline" size={12} color={colors.accent} />
              ) : null}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.scrubber}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={safeDuration}
            value={Math.min(effectivePosition, safeDuration)}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.hairline}
            thumbTintColor={colors.accent}
            onSlidingStart={() => setScrubMs(positionMs)}
            onValueChange={(value) => setScrubMs(value)}
            onSlidingComplete={(value) => {
              setScrubMs(null);
              void seek(value);
            }}
          />
          <View style={styles.timeRow}>
            <Text variant="caption" muted>
              {formatDuration(effectivePosition)}
            </Text>
            <Text variant="caption" muted>
              {progressLabel}
            </Text>
          </View>
        </View>

        <View style={styles.transport}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous track"
            hitSlop={10}
            onPress={previous}
            style={({ pressed }) => [styles.transportButton, pressed && styles.pressed]}
          >
            <Ionicons name="play-skip-back" size={30} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            hitSlop={10}
            onPress={toggle}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next track"
            hitSlop={10}
            onPress={next}
            style={({ pressed }) => [styles.transportButton, pressed && styles.pressed]}
          >
            <Ionicons name="play-skip-forward" size={30} color={colors.text} />
          </Pressable>
        </View>
      </ScrollView>

      <QueueSheet
        visible={queueOpen}
        onClose={() => setQueueOpen(false)}
        queue={queue}
        currentIndex={index}
        onSelect={(selectedIndex) => {
          setQueueOpen(false);
          if (selectedIndex !== index) {
            void playQueue(queue, selectedIndex, context);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerLabel: { letterSpacing: 2, flex: 1, textAlign: 'center' },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  iconCircleSpacer: { width: 36, height: 36 },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  emptyArt: {
    flex: 1,
    marginVertical: spacing.xxl,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  meta: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleBlock: { flex: 1, gap: spacing.xs },
  likeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licenseChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.surface,
  },
  licenseChipDisabled: { opacity: 0.8 },
  scrubber: { gap: spacing.xs },
  slider: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingVertical: spacing.md,
  },
  transportButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.8 },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingBottom: spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sheetList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetEmpty: { textAlign: 'center', paddingVertical: spacing.xl },
  queueItem: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  queueItemActive: { backgroundColor: colors.surfaceRaised },
});