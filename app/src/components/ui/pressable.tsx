import React from 'react';
import { Pressable as RNPressable, type PressableProps } from 'react-native';

import { getTVOSFocusStyles, useTVOSFocus } from '@/lib/tvos-focus';

interface EnhancedPressableProps extends PressableProps {
  className?: string;
  enableTVOSFocus?: boolean;
}

/**
 * Enhanced Pressable component with automatic tvOS focus support
 */
export const Pressable = React.forwardRef<RNPressable, EnhancedPressableProps>(
  ({ className = '', enableTVOSFocus = true, ...props }, ref) => {
    const { isFocused, focusProps } = useTVOSFocus();
    const tvFocusStyles = getTVOSFocusStyles(isFocused);

    const finalClassName = enableTVOSFocus
      ? `${className} ${tvFocusStyles}`.trim()
      : className;

    const finalProps = enableTVOSFocus ? { ...props, ...focusProps } : props;

    return <RNPressable ref={ref} className={finalClassName} {...finalProps} />;
  }
);

Pressable.displayName = 'Pressable';
