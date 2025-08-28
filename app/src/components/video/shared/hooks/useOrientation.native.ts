import * as ScreenOrientation from 'expo-screen-orientation';

export function useOrientation() {
  const lockLandscape = async () => {
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      );
    } catch (error) {
      console.warn('Failed to lock orientation:', error);
    }
  };

  const unlockOrientation = async () => {
    try {
      await ScreenOrientation.unlockAsync();
    } catch (error) {
      console.warn('Failed to unlock orientation:', error);
    }
  };

  const lockPortrait = async () => {
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT
      );
    } catch (error) {
      console.warn('Failed to lock to portrait:', error);
    }
  };

  return {
    lockLandscape,
    unlockOrientation,
    lockPortrait,
  };
}
