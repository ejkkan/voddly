import React, { useCallback, useRef } from 'react';
import { Platform, TextInput } from 'react-native';

import { isTV } from '@/lib/platform';

interface TVOSTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: any;
  className?: string;
  testID?: string;
}

/**
 * Enhanced TextInput component specifically for tvOS
 * Handles the keyboard interaction issues you're experiencing
 */
export const TVOSTextInput = React.forwardRef<TextInput, TVOSTextInputProps>(
  (
    {
      value,
      onChangeText,
      placeholder,
      secureTextEntry = false,
      onFocus,
      onBlur,
      style,
      className,
      testID,
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<TextInput>(null);

    const handleFocus = useCallback(() => {
      onFocus?.();
      // Ensure the input stays focused during keyboard interaction
      if (isTV && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }, [onFocus]);

    const handleChangeText = useCallback(
      (text: string) => {
        onChangeText(text);
        // Keep focus on this input after text changes
        if (isTV && inputRef.current) {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        }
      },
      [onChangeText]
    );

    const tvOSProps = isTV
      ? {
          // Disable automatic behaviors that cause focus jumping
          enablesReturnKeyAutomatically: false,
          blurOnSubmit: false,
          selectTextOnFocus: true,
          clearButtonMode: 'never' as const,
          returnKeyType: 'done' as const,
          autoCorrect: false,
          autoCapitalize: 'none' as const,
          spellCheck: false,
          // Add tvOS-specific focus properties
          tvParallaxProperties: {
            enabled: true,
            shiftDistanceX: 2.0,
            shiftDistanceY: 2.0,
            tiltAngle: 0.05,
            magnification: 1.05,
          },
        }
      : {};

    return (
      <TextInput
        ref={ref || inputRef}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        onFocus={handleFocus}
        onBlur={onBlur}
        style={style}
        className={className}
        testID={testID}
        {...tvOSProps}
        {...props}
      />
    );
  }
);

TVOSTextInput.displayName = 'TVOSTextInput';
