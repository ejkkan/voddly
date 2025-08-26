/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import { ClientEnv, Env } from './env';

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: Env.NAME,
  description: `${Env.NAME} Mobile App`,
  owner: Env.EXPO_ACCOUNT_OWNER,
  scheme: Env.SCHEME,
  slug: 'voddly',
  version: Env.VERSION.toString(),
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: Env.BUNDLE_ID,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocalNetworkUsageDescription:
        'This app uses the local network to play media streams from your playlists and media servers.',
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  experiments: {
    typedRoutes: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2E3C4B',
    },
    package: Env.PACKAGE,
    // Cleartext traffic allowed via AndroidManifest tweak (set below in plugins)
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-video',
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    // Add react-native-video configuration (without ad support)
    [
      './plugins/with-react-native-video',
      {
        ios: {
          videoCaching: true, // Enable video caching for better performance
        },
        android: {
          useExoplayerSmoothStreaming: true,
          useExoplayerDash: true,
          useExoplayerHls: true,
          useExoplayerIMA: false, // No ad support
          useExoplayerRtsp: false,
        },
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true, // ? enable HTTP requests
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          kotlinVersion: '1.8.0',
        },
        ios: {
          usesCleartextTraffic: true,
          flipper: true,
          deploymentTarget: '13.0', // react-native-video v6 requires iOS 13.0+
        },
      },
    ],
    [
      'expo-sqlite',
      {
        enableFTS: true,
        useSQLCipher: true,
        // android: {
        //   // Override the shared configuration for Android
        //   enableFTS: false,
        //   useSQLCipher: false,
        // },
        // ios: {
        //   // You can also override the shared configurations for iOS
        //   customBuildFlags: [
        //     '-DSQLITE_ENABLE_DBSTAT_VTAB=1 -DSQLITE_ENABLE_SNAPSHOT=1',
        //   ],
        // },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2E3C4B',
        image: './assets/splash-icon.png',
        imageWidth: 150,
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/Inter.ttf'],
      },
    ],
    'expo-localization',
    'expo-router',
    'expo-secure-store',
    ['app-icon-badge', appIconBadgeConfig],
    ['react-native-edge-to-edge'],
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
