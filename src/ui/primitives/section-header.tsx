import { StyleSheet, View } from 'react-native';

import { spacing } from '../tokens';
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
        <Text variant="label" accent onPress={onActionPress} suppressHighlighting>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  titles: { gap: 2, flexShrink: 1 },
});
