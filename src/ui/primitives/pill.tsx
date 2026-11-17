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
      onPress={onPress}
      style={[styles.base, selected && styles.selected]}
    >
      <Text variant="label" style={selected ? styles.selectedLabel : styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.textMuted },
  selectedLabel: { color: colors.ink },
});
