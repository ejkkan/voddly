import { useCallback, useState } from 'react';

import { isTV } from './platform';

/**
 * Simplified tvOS focus hook without any navigation dependencies
 */
export function useTVOSFocus() {
  // Always call hooks to follow rules of hooks
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    if (isTV) {
      setIsFocused(true);
    }
  }, []);

  const handleBlur = useCallback(() => {
    if (isTV) {
      setIsFocused(false);
    }
  }, []);

  // Return appropriate values based on platform
  if (!isTV) {
    return {
      isFocused: false,
      focusProps: {},
    };
  }

  return {
    isFocused,
    focusProps: {
      onFocus: handleFocus,
      onBlur: handleBlur,
      tvParallaxProperties: {
        enabled: true,
        shiftDistanceX: 2.0,
        shiftDistanceY: 2.0,
        tiltAngle: 0.05,
        magnification: 1.1,
        pressMagnification: 0.95,
        pressDuration: 0.3,
      },
    },
  };
}

/**
 * Get tvOS-specific focus styles
 */
export function getTVOSFocusStyles(isFocused: boolean) {
  if (!isTV) return '';

  return isFocused
    ? 'border-2 border-white transform scale-105'
    : 'border-2 border-transparent';
}

/**
 * Get default tvOS focus properties for any Pressable component
 */
export function getTVOSFocusProps() {
  if (!isTV) return {};

  return {
    tvParallaxProperties: {
      enabled: true,
      shiftDistanceX: 2.0,
      shiftDistanceY: 2.0,
      tiltAngle: 0.05,
      magnification: 1.05,
      pressMagnification: 0.95,
      pressDuration: 0.3,
    },
    hasTVPreferredFocus: false, // Set to true for the first focusable element
  };
}
