// Platform capability matrix - defines what each platform supports
export const PLATFORM_CAPABILITIES = {
  mobile: {
    hasKeyboard: false,
    hasMouse: false,
    hasTouch: true,
    hasRemote: false,
    hasBottomTabs: true,
    hasSidebar: false,
    supportedLibs: [
      'react-native-gesture-handler',
      'react-native-reanimated',
      '@gorhom/bottom-sheet',
      'react-native-keyboard-controller',
    ],
    unsupportedLibs: ['react-native-tvos-controller'],
  },
  tvos: {
    hasKeyboard: false,
    hasMouse: false,
    hasTouch: false,
    hasRemote: true,
    hasBottomTabs: false,
    hasSidebar: true,
    supportedLibs: ['react-native-tvos-controller'],
    unsupportedLibs: [
      'react-native-gesture-handler',
      '@gorhom/bottom-sheet',
      'react-native-keyboard-controller',
    ],
  },
  web: {
    hasKeyboard: true,
    hasMouse: true,
    hasTouch: false, // can be true on mobile web
    hasRemote: false,
    hasBottomTabs: false,
    hasSidebar: true,
    supportedLibs: ['react-dom', 'framer-motion'],
    unsupportedLibs: [
      'react-native-gesture-handler',
      'react-native-tvos-controller',
    ],
  },
} as const;

export type PlatformType = keyof typeof PLATFORM_CAPABILITIES;
export type PlatformCapabilities = (typeof PLATFORM_CAPABILITIES)[PlatformType];
