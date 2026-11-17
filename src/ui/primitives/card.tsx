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
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
  raised: { backgroundColor: colors.surfaceRaised },
});
