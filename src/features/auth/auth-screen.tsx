import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Screen, Text, spacing } from '@/ui';

type AuthScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthScreen({ title, subtitle, children, footer }: AuthScreenProps) {
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="caption" accent style={styles.brand}>
            DUSKWAVE
          </Text>
          <View style={styles.header}>
            <Text variant="display">{title}</Text>
            {subtitle ? <Text muted>{subtitle}</Text> : null}
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    gap: spacing.xxl,
  },
  brand: { letterSpacing: 4 },
  header: { gap: spacing.md },
  body: { gap: spacing.lg },
  footer: { marginTop: 'auto', gap: spacing.md, paddingTop: spacing.xl },
});
