import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState, Screen, Text, TextField, spacing } from '@/ui';

export default function SearchScreen() {
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Search</Text>
          <Text muted>Tracks, artists, and moods from the Duskwave catalog.</Text>
        </View>

        <TextField
          placeholder="Try 'slow burn', 'rainy', or an artist"
          autoCapitalize="none"
          returnKeyType="search"
          hint="Search goes live when the catalog lands."
        />

        <EmptyState
          title="The catalog is warming up"
          body="Free, CC-licensed tracks are being imported. Search lights up as soon as the first records land."
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: { gap: spacing.sm },
});
