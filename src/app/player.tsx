import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PlayerBar, Screen, Text, colors, spacing } from '@/ui';

export default function PlayerScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close player"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-down" size={22} color={colors.text} />
        </Pressable>
        <Text variant="caption" muted style={styles.label}>
          NOW PLAYING
        </Text>
        <View style={styles.back} />
      </View>

      <View style={styles.art}>
        <Ionicons name="moon" size={64} color={colors.accent} />
      </View>

      <View style={styles.meta}>
        <Text variant="title">Nothing playing</Text>
        <Text muted>The full player lights up with the catalog.</Text>
      </View>

      <PlayerBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  label: { letterSpacing: 2 },
  art: {
    flex: 1,
    marginVertical: spacing.xxl,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  meta: { gap: spacing.sm, marginBottom: spacing.xl },
});
