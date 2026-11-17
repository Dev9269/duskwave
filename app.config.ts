import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Duskwave',
  slug: 'duskwave',
  version: '0.1.0',
  scheme: 'duskwave',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0B0F',
  splash: {
    backgroundColor: '#0B0B0F',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.dev9269.duskwave',
  },
  android: {
    package: 'com.dev9269.duskwave',
    adaptiveIcon: {
      backgroundColor: '#0B0B0F',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: true,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-audio',
      {
        enableBackgroundPlayback: true,
        recordAudioAndroid: false,
        microphonePermission: false,
      },
    ],
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0B0F',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
