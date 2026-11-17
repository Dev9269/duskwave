import { StyleSheet, View } from 'react-native';

import { spacing } from '../tokens';
import { Text } from './text';

export type EmptyStateProps = {
  title: string;
  body?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {body ? (
        <Text variant="caption" muted style={styles.center}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
  center: { textAlign: 'center' },
});
