import { useEffect } from 'react';

export function useOrientation() {
  // Web doesn't force orientation, but we can detect it
  useEffect(() => {
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
    // Try to use Screen Orientation API if available
    if ('orientation' in screen && 'lock' in screen.orientation) {
      screen.orientation.lock('landscape').catch(() => {
        // Silently fail if not supported
      });
    }
  };

  const unlockOrientation = () => {
    if ('orientation' in screen && 'unlock' in screen.orientation) {
      screen.orientation.unlock();
    }
  };

  return {
    lockLandscape,
    unlockOrientation,
  };
}