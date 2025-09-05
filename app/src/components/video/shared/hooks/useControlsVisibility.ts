import { useCallback, useEffect, useRef, useState } from 'react';

// Hard-coded default auto-hide delay (from default theme)
const AUTO_HIDE_DELAY = 3000;

export function useControlsVisibility(initialVisible = true) {
  const [showControls, setShowControls] = useState(initialVisible);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetHideTimer = useCallback(() => {
    // Clear existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set new timer
    if (showControls) {
      timeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, AUTO_HIDE_DELAY);
    }
  }, [showControls]);

  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    resetHideTimer();
  }, [resetHideTimer]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetHideTimer]);

  return {
    showControls,
    setShowControls,
    handleUserActivity,
  };
}
