import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../themes/ThemeProvider';

export function useControlsVisibility(initialVisible = true) {
  const theme = useTheme();
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
      }, theme.animations.autoHideDelay);
    }
  }, [showControls, theme.animations.autoHideDelay]);

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