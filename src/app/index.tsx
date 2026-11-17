import { Redirect } from 'expo-router';

import { isOnboarded, useSession } from '@/features/auth/session-provider';

export default function Index() {
  const { session, profile, loading } = useSession();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!isOnboarded(profile)) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
