import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { SessionProvider, isOnboarded, useSession } from '@/features/auth/session-provider';
import { queryClient } from '@/lib/query-client';
import {
  restorePersistedPlayerState,
  startPlayerPersistence,
  stopPlayerPersistence,
} from '@/features/player/persistence';
import { usePlayerStore } from '@/features/player/player-store';
import { colors } from '@/ui';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function PlayerBootstrap() {
  useEffect(() => {
    let active = true;

    startPlayerPersistence();
    void restorePersistedPlayerState().catch(() => {
      // Restore must never block app startup on errors.
    });

    const sleepTimer = setInterval(() => {
      const state = usePlayerStore.getState();
      if (state.sleepTimerEndsAt !== null && Date.now() >= state.sleepTimerEndsAt) {
        usePlayerStore.setState({ sleepTimerEndsAt: null });
        if (state.isPlaying) state.toggle();
      }
    }, 1000);

    return () => {
      active = false;
      void active; // satisfy lint for unused in some configs; cleanup runs regardless
      clearInterval(sleepTimer);
      stopPlayerPersistence();
    };
  }, []);

  return null;
}

function RootNavigator() {
  const { session, profile, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const onboarded = isOnboarded(profile);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
      }}
    >
      <Stack.Protected guard={!session || !onboarded}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={session !== null && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="licenses" />
        <Stack.Screen name="album/[id]" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="genre/[name]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="light" />
          <PlayerBootstrap />
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
});
