import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';
import { greeting } from '@/lib/greeting';
import {
  Button,
  Card,
  EmptyState,
  PlayerBar,
  Screen,
  SectionHeader,
  Text,
  spacing,
} from '@/ui';

export default function HomeScreen() {
  const { profile } = useSession();
  const firstName = profile?.display_name?.split(' ')[0] || 'listener';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="caption" accent style={styles.brand}>
            DUSKWAVE
          </Text>
          <Text variant="display">
            {greeting()}, {firstName}
          </Text>
          <Text muted>The room is open. Your night, in sound.</Text>
        </View>

        <SectionHeader
          title="Recently played"
          caption="Your last fourteen nights, once you start listening."
        />
        <EmptyState
          title="No listening history yet"
          body="Play something, or load a demo night from Settings to preview how history and stats will look."
          action={
            <Button
              label="Open Settings"
              variant="secondary"
              onPress={() => router.push('/settings')}
            />
          }
        />

        <SectionHeader
          title="Made for the night"
          caption="Blends, Jams, and late-night mixes arrive with the catalog."
        />
        <Card raised style={styles.card}>
          <Text variant="heading">A quiet room for now</Text>
          <Text variant="caption" muted>
            The catalog, playlists, Jams, and Blends come online in the next milestone. This shell
            is the shape they will drop into.
          </Text>
        </Card>

        <View style={styles.playerWrap}>
          <PlayerBar />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  header: { gap: spacing.md },
  brand: { letterSpacing: 4 },
  card: { gap: spacing.sm },
  playerWrap: { marginTop: spacing.xxl },
});
