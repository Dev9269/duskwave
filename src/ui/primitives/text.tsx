import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typeScale, type TextVariant } from '../tokens';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  muted?: boolean;
  accent?: boolean;
  danger?: boolean;
};

export function Text({ variant = 'body', muted, accent, danger, style, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        styles.base,
        typeScale[variant],
        muted && styles.muted,
        accent && styles.accent,
        danger && styles.danger,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  muted: { color: colors.textMuted },
  accent: { color: colors.accent },
  danger: { color: colors.danger },
});
