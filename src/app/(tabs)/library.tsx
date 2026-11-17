import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Screen, SectionHeader, Text, colors, spacing } from '@/ui';

export default function LibraryScreen() {
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Your library</Text>
          <Text muted>Songs you keep, playlists you build, and the people you blend with.</Text>
        </View>

        <Card style={styles.row}>
          <View style={[styles.icon, styles.iconAccent]}>
            <Ionicons name="heart" size={20} color={colors.ink} />
          </View>
          <View style={styles.rowText}>
            <Text variant="heading">Liked songs</Text>
            <Text variant="caption" muted>
              0 tracks
            </Text>
          </View>
        </Card>

        <Card style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="albums" size={20} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text variant="heading">Playlists</Text>
            <Text variant="caption" muted>
              None yet
            </Text>
          </View>
        </Card>

        <SectionHeader title="Uploads" caption="Your own tracks live here once uploads ship." />
        <Card raised style={styles.placeholder}>
          <Text variant="heading">Nothing uploaded</Text>
          <Text variant="caption" muted>
            Free accounts get three uploads. Premium unlocks more, plus offline and crossfade.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  iconAccent: { backgroundColor: colors.accent },
  placeholder: { gap: spacing.sm },
});
