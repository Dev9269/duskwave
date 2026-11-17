import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-provider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Card, EmptyState, Screen, Skeleton, Text, colors, spacing } from '@/ui';

type LicenseTrack = {
  id: string;
  title: string;
  artist: string;
  license: string;
  licenseUrl: string;
  attribution: string;
};

type LicenseGroup = {
  license: string;
  licenseUrl: string;
  tracks: LicenseTrack[];
};

async function getLicenseAttributions(): Promise<LicenseTrack[]> {
  if (!supabase) throw new Error('Catalog is unavailable because Supabase is not configured.');

  const { data, error } = await supabase
    .from('tracks')
    .select('id, title, license, license_url, attribution, artists(name)')
    .eq('source', 'catalog')
    .not('license', 'is', null)
    .not('license_url', 'is', null)
    .not('attribution', 'is', null)
    .order('license', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw new Error(`Could not load license attributions: ${error.message}`);

  return (data ?? [])
    .map((row) => {
      const artist = (row.artists as { name?: string } | null)?.name ?? 'Unknown artist';
      if (!row.license || !row.license_url || !row.attribution) return null;
      return {
        id: row.id,
        title: row.title,
        artist,
        license: row.license,
        licenseUrl: row.license_url,
        attribution: row.attribution,
      } satisfies LicenseTrack;
    })
    .filter((row): row is LicenseTrack => row !== null);
}

function groupByLicense(tracks: LicenseTrack[]): LicenseGroup[] {
  const groups = new Map<string, LicenseGroup>();
  for (const track of tracks) {
    const key = `${track.license}::${track.licenseUrl}`;
    const existing = groups.get(key);
    if (existing) {
      existing.tracks.push(track);
      continue;
    }
    groups.set(key, { license: track.license, licenseUrl: track.licenseUrl, tracks: [track] });
  }
  return [...groups.values()].sort((a, b) => a.license.localeCompare(b.license));
}

async function openLicense(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  } catch {
    // ignore
  }
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonGroup}>
          <Skeleton height={18} width="55%" />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ))}
    </View>
  );
}

export default function LicensesScreen() {
  const { session } = useSession();
  const enabled = isSupabaseConfigured && !!session;
  const query = useQuery({
    queryKey: ['licenses', 'attributions'],
    queryFn: getLicenseAttributions,
    enabled,
    staleTime: 5 * 60_000,
  });

  const groups = useMemo(() => groupByLicense(query.data ?? []), [query.data]);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text variant="title">Licenses & attribution</Text>
        </View>

        <Text muted>
          Every catalog track is Creative Commons licensed. Attribution travels with each track.
        </Text>

        {!isSupabaseConfigured || !session ? (
          <EmptyState
            title="Catalog unavailable"
            body={
              !isSupabaseConfigured
                ? 'Supabase is not configured, so license attributions cannot load.'
                : 'Sign in to view license attributions.'
            }
          />
        ) : null}

        {enabled && query.isLoading ? <LoadingState /> : null}

        {enabled && query.error ? (
          <EmptyState
            title="Could not load licenses"
            body={query.error instanceof Error ? query.error.message : 'Please try again in a moment.'}
          />
        ) : null}

        {enabled && !query.isLoading && !query.error && groups.length === 0 ? (
          <EmptyState
            title="No attributions yet"
            body="Licensed catalog tracks with attribution will appear here once they are available."
          />
        ) : null}

        {enabled && !query.isLoading && !query.error
          ? groups.map((group) => (
              <View key={`${group.license}-${group.licenseUrl}`} style={styles.group}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${group.license}`}
                  onPress={() => void openLicense(group.licenseUrl)}
                  style={({ pressed }) => [styles.licenseHeader, pressed && styles.pressed]}
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
                  <Text variant="heading" style={styles.licenseName}>
                    {group.license}
                  </Text>
                  <Ionicons name="open-outline" size={14} color={colors.textMuted} />
                </Pressable>

                <Card style={styles.trackCard}>
                  {group.tracks.map((track, index) => (
                    <View key={track.id} style={[styles.track, index > 0 && styles.trackDivider]}>
                      <Text variant="bodyMedium" numberOfLines={2}>
                        {track.title}
                      </Text>
                      <Text variant="caption" muted numberOfLines={1}>
                        {track.artist}
                      </Text>
                      <Text variant="caption" muted>
                        {track.attribution}
                      </Text>
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Open license for ${track.title}`}
                        onPress={() => void openLicense(track.licenseUrl)}
                        style={({ pressed }) => [styles.urlRow, pressed && styles.pressed]}
                      >
                        <Text variant="caption" accent numberOfLines={1} style={styles.urlText}>
                          {track.licenseUrl}
                        </Text>
                        <Ionicons name="open-outline" size={12} color={colors.accent} />
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  loading: { gap: spacing.lg },
  skeletonGroup: { gap: spacing.sm },
  group: { gap: spacing.sm },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  licenseName: { flexShrink: 1 },
  trackCard: { gap: 0, paddingVertical: spacing.sm },
  track: { gap: spacing.xs, paddingVertical: spacing.md },
  trackDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  urlText: { flexShrink: 1 },
  pressed: { opacity: 0.8 },
});
