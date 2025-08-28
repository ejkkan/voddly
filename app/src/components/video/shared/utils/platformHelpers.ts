import { Platform } from 'react-native';

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function isMobile(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

export function shouldUseMKVPlayer(url: string): boolean {
  // Use VLC player for MKV files on mobile
  return isMobile() && url.toLowerCase().endsWith('.mkv');
}

export function getDefaultPlayer(
  url: string
): 'web' | 'rn-video' | 'vlc' | 'expo-video' {
  if (isWeb()) return 'web';

  // Check file extension for mobile
  if (shouldUseMKVPlayer(url)) return 'vlc';

  // Default to react-native-video for mobile (better performance and features)
  return 'rn-video';
}
