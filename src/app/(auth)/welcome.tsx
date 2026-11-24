import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SocialButtons } from '@/features/auth/social-buttons';
import { Button, Text, colors, spacing } from '@/ui';

export default function WelcomeScreen() {
  return (
    <LinearGradient
      colors={['#143C24', '#07130C', colors.ink]}
      locations={[0, 0.42, 1]}
      style={styles.fill}
    >
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text variant="label" accent style={styles.wordmark}>
            DUSKWAVE
          </Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="moon" size={54} color={colors.accent} />
          </View>
          <Text variant="display" style={styles.title}>
            Night sounds,{'\n'}shared.
          </Text>
          <Text muted style={styles.subtitle}>
            A listening room for the hours after dark. Licensed music, your playlists, and the
            people you listen with.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Sign up free"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/sign-up')}
          />
          <SocialButtons />
          <Button
            label="Log in"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/sign-in')}
          />
          <Text variant="caption" muted style={styles.legal}>
            By continuing, you agree to the Duskwave terms and privacy policy.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  wordmark: { letterSpacing: 4 },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  mark: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.35)',
  },
  title: { fontSize: 40, lineHeight: 46, letterSpacing: -1.5 },
  subtitle: { maxWidth: 340 },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  legal: { textAlign: 'center', paddingHorizontal: spacing.md },
});
