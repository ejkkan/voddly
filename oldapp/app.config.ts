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

export default ({ config }: ConfigContext): ExpoConfig => {
  const isTV = process.env.EXPO_TV === '1' || process.env.EXPO_TV === 'true';

  return {
    ...config,
    name: Env.NAME,
    description: `${Env.NAME} Mobile App`,
    owner: Env.EXPO_ACCOUNT_OWNER,
    scheme: Env.SCHEME,
    slug: 'obytesapp',
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
      // Set deployment target based on platform
      deploymentTarget: isTV ? '17.0' : '13.0',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
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
      // Only apply TV config when EXPO_TV is set
      ...(isTV ? [['@react-native-tvos/config-tv', { isTV: true }]] : []),
      // Automatically set correct deployment targets for iOS/tvOS
      './plugins/withPlatformDeploymentTarget',
      ['app-icon-badge', appIconBadgeConfig],
      ['react-native-edge-to-edge'],
      // Conditionally configure react-native-video based on platform
      [
        'react-native-video',
        {
          enableNotificationControls: false,
          enableBackgroundAudio: false,
          // Disable iOS-specific features that don't work on tvOS
          enableADSExtension: !isTV, // Google IMA - not compatible with tvOS
          enableCacheExtension: !isTV, // Video caching - not compatible with tvOS
          androidExtensions: {
            useExoplayerRtsp: false,
            useExoplayerSmoothStreaming: true,
            useExoplayerHls: true,
            useExoplayerDash: true,
            useExoplayerIMA: false, // Set to true if you want Google IMA on Android
          },
          enableAndroidPictureInPicture: false,
        },
      ],
    ],
    extra: {
      ...ClientEnv,
      eas: {
        projectId: Env.EAS_PROJECT_ID,
      },
    },
  };
};
