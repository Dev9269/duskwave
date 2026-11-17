import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, radii, spacing } from '../tokens';
import { Text } from './text';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
};

export function TextField({ label, error, hint, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text variant="label" muted style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? (
        <Text variant="caption" danger>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  label: { marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: { borderColor: colors.danger },
});
