import { Platform } from 'react-native';

// Expo Router requires a non-platform-specific route file.
// Delegate to the platform-specific implementation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Impl =
  Platform.OS === 'web'
    ? require('./player.web').default
    : require('./player.native').default;

export default Impl;
