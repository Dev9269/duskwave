import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from './tokens';
import { Text } from './primitives/text';

export type PlayerBarProps = {
  title?: string;
  subtitle?: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function PlayerBar({
  title = 'Nothing playing',
  subtitle = 'Pick a track once the catalog lands',
  disabled = true,
  onPress,
}: PlayerBarProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={styles.art}>
        <Ionicons name="moon" size={18} color={colors.accent} />
      </View>
      <View style={styles.meta}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.transport}>
        <Ionicons name="play-skip-back" size={18} color={colors.textFaint} />
        <Ionicons name="play" size={20} color={colors.textFaint} />
        <Ionicons name="play-skip-forward" size={18} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.9 },
  art: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  meta: { flex: 1, gap: 2 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingRight: spacing.xs },
});
