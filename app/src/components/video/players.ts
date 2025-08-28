import { Platform, UIManager } from 'react-native';

export type PlayerId = 'vlc' | 'expo' | 'web' | 'rn-video';

export type PlayerMeta = {
  id: PlayerId;
  label: string;
};

// Only expose the Web player on web. On native, expose VLC, Expo Video, and React Native Video.
// Detect whether the native VLC view manager is registered. If not, hide VLC.
// This prevents crashes like "View config not found for component RCTVLCPlayer" on Android
// when the VLC library is not linked or not compatible with the current architecture.
const isVlcNativeViewAvailable = (() => {
  if (Platform.OS === 'web') return false;
  try {
    // RN >=0.62: prefer getViewManagerConfig. Check common names.
    const byRCTVLC = UIManager.getViewManagerConfig?.('RCTVLCPlayer');
    const byVLC = UIManager.getViewManagerConfig?.('VLCPlayer');
    return Boolean(byRCTVLC || byVLC);
  } catch {
    return false;
  }
})();

export const AVAILABLE_PLAYERS: PlayerMeta[] = (() => {
  if (Platform.OS === 'web') {
    return [{ id: 'web' as const, label: 'Web Player' }];
  }
  const list: PlayerMeta[] = [
    { id: 'expo', label: 'Expo Video' },
    { id: 'rn-video', label: 'React Native Video' },
  ];
  if (isVlcNativeViewAvailable) list.push({ id: 'vlc', label: 'MKV (VLC)' });
  return list;
})();

export function getDefaultPlayerId(): PlayerId {
  if (Platform.OS === 'web') return 'web';
  // On native, prefer React Native Video as default, fallback to VLC if available, then Expo
  if (isVlcNativeViewAvailable) return 'vlc';
  return 'rn-video';
}
