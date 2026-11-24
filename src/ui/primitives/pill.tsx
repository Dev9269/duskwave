import { Pressable, StyleSheet } from 'react-native';

import { colors, radii, spacing } from '../tokens';
import { Text } from './text';

export type PillProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Pill({ label, selected, onPress }: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.base, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text variant="label" style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
  },
  selected: { backgroundColor: colors.text },
  pressed: { opacity: 0.8 },
  label: { color: colors.text },
  selectedLabel: { color: colors.ink },
});
