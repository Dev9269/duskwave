import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '../tokens';

export type CardProps = ViewProps & {
  padded?: boolean;
  raised?: boolean;
};

export function Card({ padded = true, raised, style, ...props }: CardProps) {
  return (
    <View
      {...props}
      style={[styles.base, padded && styles.padded, raised && styles.raised, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
  raised: { backgroundColor: colors.elevated },
});
