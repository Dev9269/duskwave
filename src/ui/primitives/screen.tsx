import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '../tokens';

export type ScreenProps = ViewProps & {
  padded?: boolean;
  edges?: readonly Edge[];
};

export function Screen({ padded = true, edges = ['top', 'bottom'], style, ...props }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View {...props} style={[styles.content, padded && styles.padded, style]} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { flex: 1, backgroundColor: colors.ink },
  padded: { paddingHorizontal: spacing.lg },
});
