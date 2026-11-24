import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, radii, spacing } from '../tokens';
import { Text } from './text';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
};

export function TextField({ label, error, hint, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

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
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
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
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.textFaint,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputFocused: { borderColor: colors.text },
  inputError: { borderColor: colors.danger },
});
