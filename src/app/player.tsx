import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { useSession } from '@/features/auth/session-provider';
import type { Track } from '@/features/catalog/api';
import { useTrackLike } from '@/features/catalog/use-track-like';
import { useJamStore } from '@/features/jam/jam-store';
import { usePlayerStore } from '@/features/player/player-store';
import { formatDuration } from '@/lib/format';
import type { PlayContext } from '@/types/database';
import { Button, Text, TextField, colors, fontFamily, radii, spacing } from '@/ui';
import { TrackRow } from '@/ui/primitives/track-row';

const CONTEXT_LABELS: Record<PlayContext, string> = {
  album: 'Album',
  playlist: 'Playlist',
  search: 'Search',
  blend: 'Blend',
  jam: 'Jam',
  liked: 'Liked Songs',
  history: 'Recently played',
};

const SLEEP_OPTIONS = [5, 10, 15, 30, 45, 60];

function QueueSheet({
  visible,
  onClose,
  queue,
  currentIndex,
  onSelect,
  onRemove,
  onMove,
}: {
  visible: boolean;
  onClose: () => void;
  queue: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const current = queue[currentIndex];
  const upcoming = queue.slice(currentIndex + 1);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close queue" />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text variant="heading">Queue</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close queue" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {current ? (
              <>
                <Text variant="caption" muted style={styles.sheetSection}>
                  Now playing
                </Text>
                <View style={[styles.queueItem, styles.queueItemActive]}>
                  <TrackRow
                    title={current.title}
                    artist={current.artist}
                    artworkUrl={current.coverUrl}
                    onPress={() => onSelect(currentIndex)}
                    trailing={<Ionicons name="volume-high" size={16} color={colors.accent} />}
                  />
                </View>
              </>
            ) : null}

            {upcoming.length > 0 ? (
              <Text variant="caption" muted style={styles.sheetSection}>
                Next in queue
              </Text>
            ) : null}
            {upcoming.map((item, offset) => {
              const index = currentIndex + 1 + offset;
              return (
                <View key={`${item.id}-${index}`} style={styles.queueItem}>
                  <TrackRow
                    title={item.title}
                    artist={item.artist}
                    artworkUrl={item.coverUrl}
                    onPress={() => onSelect(index)}
                    trailing={
                      <View style={styles.queueControls}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Move up"
                          hitSlop={6}
                          onPress={() => onMove(index, index - 1)}
                        >
                          <Ionicons name="arrow-up-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Move down"
                          hitSlop={6}
                          disabled={index >= queue.length - 1}
                          onPress={() => onMove(index, index + 1)}
                        >
                          <Ionicons name="arrow-down-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove from queue"
                          hitSlop={6}
                          onPress={() => onRemove(index)}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    }
                  />
                </View>
              );
            })}

            {!current && upcoming.length === 0 ? (
              <Text muted style={styles.sheetEmpty}>
                Queue is empty.
              </Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function JamSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const jam = useJamStore();
  const { session, profile } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id ?? 'local-listener';
  const name = profile?.display_name ?? session?.user.email?.split('@')[0] ?? 'Listener';

  const start = async () => {
    setBusy(true);
    await jam.start(userId, name);
    setBusy(false);
  };

  const join = async () => {
    setBusy(true);
    await jam.join(code, userId, name);
    setBusy(false);
  };

  const invite = async () => {
    if (!jam.code) return;
    try {
      await Share.share({ message: `Join my Duskwave Jam with code ${jam.code}` });
    } catch {
      // ignore
    }
  };

  const leave = async () => {
    await jam.leave();
    setCode('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close Jam" />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text variant="heading">Jam</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Jam" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {!jam.active ? (
              <>
                <Text muted>
                  Start a shared listening room, or join one with a code. The host controls what
                  everyone hears.
                </Text>
                <Button label="Start a Jam" size="lg" fullWidth loading={busy} onPress={() => void start()} />
                <Text variant="caption" muted style={styles.sheetSection}>
                  Have a code?
                </Text>
                <TextField
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  keyboardType="number-pad"
                  accessibilityLabel="Jam code"
                  style={styles.codeInput}
                />
                <Button
                  label="Join Jam"
                  variant="secondary"
                  fullWidth
                  loading={busy}
                  disabled={code.length !== 4}
                  onPress={() => void join()}
                />
              </>
            ) : (
              <>
                <View style={styles.jamBadge}>
                  <Text variant="heading" accent>
                    JAM {jam.code}
                  </Text>
                </View>
                <Text muted>
                  {jam.synced
                    ? 'Listening together in real time.'
                    : 'Local Jam: realtime is unavailable, so only this device is connected.'}
                </Text>
                <Text variant="caption" muted style={styles.sheetSection}>
                  LISTENERS
                </Text>
                {jam.participants.map((participant) => (
                  <View key={participant.id} style={styles.participant}>
                    <Ionicons name="person-circle-outline" size={22} color={colors.textMuted} />
                    <Text>
                      {participant.name}
                      {participant.id === userId ? ' (you)' : ''}
                    </Text>
                  </View>
                ))}
                <Button label="Share invite code" variant="secondary" fullWidth onPress={() => void invite()} />
                <Button
                  label={jam.role === 'host' ? 'End Jam' : 'Leave Jam'}
                  variant="danger"
                  fullWidth
                  onPress={() => void leave()}
                />
              </>
            )}
            {jam.error ? (
              <Text variant="caption" danger style={styles.sheetSection}>
                {jam.error}
              </Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SleepTimerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { sleepTimerEndsAt, setSleepTimer } = usePlayerStore();
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  const minutesLeft =
    sleepTimerEndsAt === null || now === 0
      ? null
      : Math.max(1, Math.ceil((sleepTimerEndsAt - now) / 60_000));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sleep timer" />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text variant="heading">Sleep timer</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close sleep timer" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {minutesLeft !== null ? (
              <Text accent style={styles.sheetSection}>
                Playback stops in about {minutesLeft} min
              </Text>
            ) : null}
            {SLEEP_OPTIONS.map((minutes) => (
              <Pressable
                key={minutes}
                accessibilityRole="button"
                accessibilityLabel={`Stop after ${minutes} minutes`}
                style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}
                onPress={() => {
                  setSleepTimer(minutes);
                  onClose();
                }}
              >
                <Text>{minutes} minutes</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
            {minutesLeft !== null ? (
              <Button
                label="Turn off timer"
                variant="secondary"
                fullWidth
                onPress={() => {
                  setSleepTimer(null);
                  onClose();
                }}
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function LyricsSheet({ visible, onClose, track }: { visible: boolean; onClose: () => void; track: Track | null }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close lyrics" />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text variant="heading">Lyrics</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close lyrics" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.sheetContent}>
            <Ionicons name="musical-notes-outline" size={38} color={colors.textFaint} />
            <Text variant="heading" style={styles.sheetSection}>
              {track?.title ?? 'Nothing playing'}
            </Text>
            <Text muted>
              Lyrics are not part of the Creative Commons catalog yet. Share the track with a
              friend instead.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function PlayerScreen() {
  const {
    queue,
    index,
    context,
    currentTrack,
    isPlaying,
    positionMs,
    durationMs,
    sleepTimerEndsAt,
    shuffle,
    repeat,
    toggle,
    next,
    previous,
    seek,
    playQueue,
    toggleShuffle,
    cycleRepeat,
    removeFromQueue,
    moveInQueue,
  } = usePlayerStore();
  const jam = useJamStore();
  const [queueOpen, setQueueOpen] = useState(false);
  const [jamOpen, setJamOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const like = useTrackLike(currentTrack?.id ?? null);

  const swipeX = useMemo(() => new Animated.Value(0), []);
  const swipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderMove: (_event, gesture) => {
        swipeX.setValue(Math.max(-130, Math.min(130, gesture.dx)));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx < -55) next();
        else if (gesture.dx > 55) previous();
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        swipeX.setValue(0);
      },
    }),
    [next, previous, swipeX],
  );

  const effectivePosition = scrubMs ?? positionMs;
  const safeDuration = durationMs > 0 ? durationMs : Math.max(currentTrack?.durationMs ?? 0, 1);
  const remaining = Math.max(safeDuration - effectivePosition, 0);

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

  const shareTrack = useCallback(async () => {
    if (!currentTrack) return;
    const lines = [`${currentTrack.title} — ${currentTrack.artist}`, 'via Duskwave'];
    if (currentTrack.license) {
      lines.push(
        `License: ${currentTrack.license}${currentTrack.licenseUrl ? ` (${currentTrack.licenseUrl})` : ''}`,
      );
    }
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // ignore
    }
  }, [currentTrack]);

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={['#3A3A3A', '#121212', '#000000']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close player"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </Pressable>
        {currentTrack ? (
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>PLAYING FROM</Text>
            <Text style={styles.contextLabel} numberOfLines={1}>
              {CONTEXT_LABELS[context]}
            </Text>
          </View>
        ) : (
          <Text style={styles.contextLabel}>Now playing</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Jam"
          hitSlop={12}
          onPress={() => setJamOpen(true)}
          style={styles.headerSide}
        >
          <Ionicons name="people-outline" size={22} color={jam.active ? colors.accent : colors.text} />
        </Pressable>
      </View>

      {jam.active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Jam details"
          onPress={() => setJamOpen(true)}
          style={styles.jamBanner}
        >
          <Ionicons name="people" size={14} color={colors.ink} />
          <Text style={styles.jamBannerText}>
            JAM {jam.code} · {jam.participants.length} listening
          </Text>
        </Pressable>
      ) : null}

      {!currentTrack || queue.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyArt}>
            <Ionicons name="moon" size={64} color={colors.accent} />
          </View>
          <Text variant="heading">Nothing playing</Text>
          <Text muted>Pick a track to start listening.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Animated.View
              {...swipeResponder.panHandlers}
              style={[styles.artWrap, { transform: [{ translateX: swipeX }] }]}
            >
              {currentTrack.coverUrl ? (
                <Image source={{ uri: currentTrack.coverUrl }} style={styles.art} contentFit="cover" />
              ) : (
                <View style={[styles.art, styles.artPlaceholder]}>
                  <Ionicons name="musical-notes" size={72} color={colors.textMuted} />
                </View>
              )}
            </Animated.View>
            <View style={styles.swipeHint}>
              <Ionicons name="arrow-back" size={12} color={colors.textFaint} />
              <Text variant="caption" muted>
                Swipe the artwork to change tracks
              </Text>
              <Ionicons name="arrow-forward" size={12} color={colors.textFaint} />
            </View>

            <View style={styles.meta}>
              <View style={styles.titleRow}>
                <View style={styles.titleBlock}>
                  <Text style={styles.title} numberOfLines={2}>
                    {currentTrack.title}
                  </Text>
                  <Text muted numberOfLines={1} style={styles.artist}>
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
                  style={({ pressed }) => [styles.licenseChip, pressed && currentTrack.licenseUrl && styles.pressed]}
                >
                  <Ionicons name="shield-checkmark-outline" size={12} color={colors.textMuted} />
                  <Text variant="caption" muted numberOfLines={1}>
                    {currentTrack.license}
                  </Text>
                  {currentTrack.licenseUrl ? (
                    <Ionicons name="open-outline" size={11} color={colors.textMuted} />
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
                minimumTrackTintColor={colors.text}
                maximumTrackTintColor={colors.hairline}
                thumbTintColor={colors.text}
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
                  -{formatDuration(remaining)}
                </Text>
              </View>
            </View>

            <View style={styles.transport}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
                accessibilityState={{ selected: shuffle }}
                hitSlop={8}
                onPress={toggleShuffle}
                style={styles.controlButton}
              >
                <Ionicons name="shuffle" size={22} color={shuffle ? colors.accent : colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous track"
                hitSlop={10}
                onPress={previous}
                style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}
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
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color={colors.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next track"
                hitSlop={10}
                onPress={next}
                style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}
              >
                <Ionicons name="play-skip-forward" size={30} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Repeat: ${repeat}`}
                hitSlop={8}
                onPress={cycleRepeat}
                style={styles.controlButton}
              >
                <Ionicons
                  name={repeat === 'off' ? 'repeat-outline' : repeat === 'one' ? 'repeat' : 'repeat'}
                  size={22}
                  color={repeat === 'off' ? colors.text : colors.accent}
                />
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Pressable accessibilityRole="button" accessibilityLabel="Lyrics" hitSlop={8} onPress={() => setLyricsOpen(true)}>
                <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sleep timer"
                hitSlop={8}
                onPress={() => setTimerOpen(true)}
              >
                <Ionicons
                  name="timer-outline"
                  size={22}
                  color={sleepTimerEndsAt !== null ? colors.accent : colors.text}
                />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Share track" hitSlop={8} onPress={() => void shareTrack()}>
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open Jam" hitSlop={8} onPress={() => setJamOpen(true)}>
                <Ionicons name="people-outline" size={22} color={jam.active ? colors.accent : colors.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open queue" hitSlop={8} onPress={() => setQueueOpen(true)}>
                <Ionicons name="list" size={24} color={colors.text} />
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
              if (selectedIndex !== index) void playQueue(queue, selectedIndex, context);
            }}
            onRemove={(targetIndex) => void removeFromQueue(targetIndex)}
            onMove={(from, to) => void moveInQueue(from, to)}
          />
          <JamSheet visible={jamOpen} onClose={() => setJamOpen(false)} />
          <SleepTimerSheet visible={timerOpen} onClose={() => setTimerOpen(false)} />
          <LyricsSheet visible={lyricsOpen} onClose={() => setLyricsOpen(false)} track={currentTrack} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerSide: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    color: colors.textMuted,
    fontFamily: fontFamily.bodyMedium,
  },
  contextLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    fontFamily: fontFamily.bodySemibold,
    textAlign: 'center',
  },
  jamBanner: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    marginBottom: spacing.sm,
  },
  jamBannerText: { color: colors.ink, fontSize: 12, fontFamily: fontFamily.bodyBold },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  artWrap: { alignSelf: 'center' },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  artPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  meta: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleBlock: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 22, lineHeight: 28, color: colors.text },
  artist: { fontSize: 14, lineHeight: 20 },
  likeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  licenseChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  scrubber: { gap: 0 },
  slider: { width: '100%', height: 36 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  controlButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  pressed: { opacity: 0.7 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyArt: {
    width: 180,
    height: 180,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.sm,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  sheetSection: { marginTop: spacing.sm },
  sheetEmpty: { textAlign: 'center', paddingVertical: spacing.xl },
  queueItem: { borderRadius: radii.sm, paddingHorizontal: spacing.xs },
  queueItemActive: { backgroundColor: colors.surfaceRaised },
  queueControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codeInput: { textAlign: 'center', fontSize: 20, letterSpacing: 8 },
  jamBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  participant: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
});
