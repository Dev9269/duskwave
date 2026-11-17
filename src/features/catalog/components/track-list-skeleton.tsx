import { StyleSheet, View } from 'react-native';

import { Skeleton, spacing } from '@/ui';

export function TrackListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={48} height={48} radius={8} />
          <View style={styles.meta}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { flex: 1, gap: spacing.sm },
});
