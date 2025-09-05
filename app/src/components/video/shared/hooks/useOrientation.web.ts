import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useOrientation() {
  // Web doesn't force orientation, but we can detect it
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleOrientationChange = () => {
      // Could emit events or update state if needed
      console.log('Orientation changed:', window.orientation);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const lockLandscape = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Try to use Screen Orientation API if available
    if ('orientation' in screen && 'lock' in screen.orientation) {
      screen.orientation.lock('landscape').catch(() => {
        // Silently fail if not supported
      });
    }
  };

  const unlockOrientation = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    if ('orientation' in screen && 'unlock' in screen.orientation) {
      screen.orientation.unlock();
    }
  };

  return {
    lockLandscape,
    unlockOrientation,
  };
}
