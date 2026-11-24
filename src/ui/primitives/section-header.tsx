import { Pressable, StyleSheet, View } from 'react-native';

import { fontFamily, spacing } from '../tokens';
import { Text } from './text';

export type SectionHeaderProps = {
  title: string;
  caption?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({ title, caption, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text variant="heading">{title}</Text>
        {caption ? (
          <Text variant="caption" muted>
            {caption}
          </Text>
        ) : null}
      </View>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onActionPress}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text variant="caption" muted style={styles.action}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  titles: { gap: 2, flexShrink: 1 },
  action: { fontFamily: fontFamily.bodySemibold, letterSpacing: 0.2 },
  pressed: { opacity: 0.7 },
});
