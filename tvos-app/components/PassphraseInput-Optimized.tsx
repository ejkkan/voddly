import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { validatePassphrase, getValidationErrorMessage } from '../lib/validation';
import { PassphraseInputProps, PassphraseInputState } from '../lib/types';

// Constants to avoid re-creating objects
const ANIMATION_CONFIG = {
  shake: {
    toValue: 10,
    duration: 50,
    useNativeDriver: true,
  },
  success: {
    toValue: 1,
    friction: 3,
    tension: 40,
    useNativeDriver: true,
  },
} as const;

const STYLES = {
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: 40,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 600,
    minHeight: 400,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold' as const,
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 20,
    textAlign: 'center' as const,
    lineHeight: 28,
  },
  accountName: {
    color: '#888',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  inputContainer: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    fontSize: 24,
    color: '#fff',
    textAlign: 'center' as const,
    letterSpacing: 2,
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  inputTvOS: Platform.isTV ? {
    shadowColor: '#4a9eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  } : {},
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    marginTop: 12,
    textAlign: 'center' as const,
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden' as const,
    marginBottom: 15,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a9eff',
    borderRadius: 3,
  },
  progressText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  progressTime: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  progressNote: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center' as const,
  },
  successContainer: {
    alignItems: 'center' as const,
    marginBottom: 30,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00c851',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 15,
  },
  successText: {
    color: '#00c851',
    fontSize: 24,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
  buttonContainer: {
    flexDirection: 'row' as const,
    gap: 20,
    justifyContent: 'center' as const,
  },
  cancelButton: {
    backgroundColor: '#333',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 120,
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  submitButton: {
    backgroundColor: '#4a9eff',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 160,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonTvOS: Platform.isTV ? {
    shadowColor: '#4a9eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  } : {},
  buttonText: {
    color: '#fff',
    fontSize: 20,
    textAlign: 'center' as const,
  },
  buttonTextBold: {
    fontWeight: '600' as const,
  },
  securityNote: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center' as const,
    marginTop: 20,
    lineHeight: 20,
  },
  processingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
} as const;

// Memoized components to prevent unnecessary re-renders
const MemoizedProgressBar = React.memo<{ progress: number }>(({ progress }) => (
  <View style={STYLES.progressBar}>
    <Animated.View
      style={[
        STYLES.progressFill,
        { width: `${progress}%` }
      ]}
    />
  </View>
));

const MemoizedSuccessIcon = React.memo<{ scale: Animated.Value }>(({ scale }) => (
  <Animated.View
    style={[
      STYLES.successContainer,
      { transform: [{ scale }] }
    ]}
  >
    <View style={STYLES.successIcon}>
      <Text style={{ fontSize: 40, color: '#fff' }}>✓</Text>
    </View>
    <ThemedText style={STYLES.successText}>
      Passphrase Validated!
    </ThemedText>
  </Animated.View>
));

export function PassphraseInputOptimized({
  onSubmit,
  onCancel,
  title = 'Enter Passphrase',
  subtitle = 'Please enter your 6-digit passphrase to continue',
  accountName,
  isVisible = true,
  disabled = false,
  autoFocus = true,
}: PassphraseInputProps) {
  // State management
  const [state, setState] = useState<PassphraseInputState>({
    passphrase: '',
    isProcessing: false,
    error: null,
    showSuccess: false,
    progress: 0,
    progressMessage: '',
    elapsedSeconds: 0,
  });

  // Refs for animations and input
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Memoized validation
  const validation = useMemo(() => {
    if (!state.passphrase) return { valid: true };
    return validatePassphrase(state.passphrase);
  }, [state.passphrase]);

  // Debounced error setting to prevent excessive re-renders
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Memoized input styles
  const inputStyle = useMemo(() => [
    STYLES.input,
    state.error ? STYLES.inputError : null,
    STYLES.inputTvOS,
  ], [state.error]);

  // Cleanup timer effect
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer for elapsed seconds
  useEffect(() => {
    if (state.isProcessing && !state.showSuccess) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, elapsedSeconds: elapsed }));
      }, 1000); // Update every second instead of 100ms for better performance

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [state.isProcessing, state.showSuccess]);

  // Auto-focus effect
  useEffect(() => {
    if (isVisible && !state.isProcessing && autoFocus) {
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isVisible, state.isProcessing, autoFocus]);

  // Reset state when visibility changes
  useEffect(() => {
    if (isVisible) {
      setState({
        passphrase: '',
        isProcessing: false,
        error: null,
        showSuccess: false,
        progress: 0,
        progressMessage: '',
        elapsedSeconds: 0,
      });
      successScale.setValue(0);
    }
  }, [isVisible, successScale]);

  // Memoized animation functions
  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, ANIMATION_CONFIG.shake),
      Animated.timing(shakeAnim, { ...ANIMATION_CONFIG.shake, toValue: -10 }),
      Animated.timing(shakeAnim, ANIMATION_CONFIG.shake),
      Animated.timing(shakeAnim, { ...ANIMATION_CONFIG.shake, toValue: 0 }),
    ]).start();
  }, [shakeAnim]);

  const successAnimation = useCallback(() => {
    Animated.spring(successScale, ANIMATION_CONFIG.success).start();
  }, [successScale]);

  // Memoized handlers
  const handlePassphraseChange = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      passphrase: text,
      error: null, // Clear error on input
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state.passphrase || state.passphrase.length < 6) {
      const errorMsg = 'Passphrase must be at least 6 characters';
      setError(errorMsg);
      shakeAnimation();
      return;
    }

    // Validate passphrase format
    if (!validation.valid) {
      const errorMsg = getValidationErrorMessage(validation);
      setError(errorMsg);
      shakeAnimation();
      return;
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      progress: 0,
      progressMessage: 'Starting validation...',
    }));

    try {
      await onSubmit(state.passphrase, (progress, message) => {
        setState(prev => ({
          ...prev,
          progress: Math.round(progress * 100),
          progressMessage: message || `Processing... ${Math.round(progress * 100)}%`,
        }));
      });

      setState(prev => ({
        ...prev,
        progress: 100,
        progressMessage: 'Validation complete!',
        showSuccess: true,
      }));
      
      successAnimation();

      // Auto-close after success animation
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          showSuccess: false,
          progress: 0,
          progressMessage: '',
        }));
      }, 2000);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Invalid passphrase',
        progress: 0,
        progressMessage: '',
      }));
      shakeAnimation();
    }
  }, [state.passphrase, validation, onSubmit, setError, shakeAnimation, successAnimation]);

  const handleCancel = useCallback(() => {
    if (!state.isProcessing && onCancel) {
      onCancel();
    }
  }, [state.isProcessing, onCancel]);

  const handleKeyPress = useCallback(() => {
    if (!state.isProcessing) {
      handleSubmit();
    }
  }, [state.isProcessing, handleSubmit]);

  // Early return if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        STYLES.container,
        { transform: [{ translateX: shakeAnim }] }
      ]}
    >
      <View style={STYLES.modal}>
        {/* Header */}
        <View style={STYLES.header}>
          <ThemedText style={STYLES.title}>
            {title}
          </ThemedText>
          {accountName && (
            <ThemedText style={STYLES.accountName}>
              Account: {accountName}
            </ThemedText>
          )}
          <ThemedText style={STYLES.subtitle}>
            {subtitle}
          </ThemedText>
        </View>

        {/* Input Field */}
        <View style={STYLES.inputContainer}>
          <TextInput
            ref={inputRef}
            value={state.passphrase}
            onChangeText={handlePassphraseChange}
            placeholder="Enter your passphrase"
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!state.isProcessing && !disabled}
            onSubmitEditing={handleKeyPress}
            returnKeyType="done"
            blurOnSubmit={false}
            style={inputStyle}
            // tvOS specific props
            {...(Platform.isTV && {
              autoFocus: autoFocus,
              selectTextOnFocus: true,
            })}
          />
          {state.error && (
            <ThemedText style={STYLES.errorText}>
              {state.error}
            </ThemedText>
          )}
        </View>

        {/* Progress Indicator */}
        {state.isProcessing && !state.showSuccess && (
          <View style={STYLES.progressContainer}>
            <MemoizedProgressBar progress={state.progress} />
            <ThemedText style={STYLES.progressText}>
              {state.progressMessage || `Processing... ${state.progress}%`}
            </ThemedText>
            <ThemedText style={STYLES.progressTime}>
              {state.elapsedSeconds}s elapsed
            </ThemedText>
            <ThemedText style={STYLES.progressNote}>
              Using 100,000 iterations for tvOS optimization
            </ThemedText>
          </View>
        )}

        {/* Success Animation */}
        {state.showSuccess && (
          <MemoizedSuccessIcon scale={successScale} />
        )}

        {/* Action Buttons */}
        {!state.showSuccess && (
          <View style={STYLES.buttonContainer}>
            {onCancel && (
              <ThemedButton
                onPress={handleCancel}
                disabled={state.isProcessing || disabled}
                style={[
                  STYLES.cancelButton,
                  (state.isProcessing || disabled) && STYLES.cancelButtonDisabled,
                ]}
                textStyle={STYLES.buttonText}
              >
                Cancel
              </ThemedButton>
            )}

            <ThemedButton
              onPress={handleSubmit}
              disabled={state.isProcessing || !state.passphrase || disabled}
              style={[
                STYLES.submitButton,
                (state.isProcessing || !state.passphrase || disabled) && STYLES.submitButtonDisabled,
                STYLES.submitButtonTvOS,
              ]}
              textStyle={[STYLES.buttonText, STYLES.buttonTextBold]}
            >
              {state.isProcessing ? (
                <View style={STYLES.processingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={STYLES.buttonText}>Processing</Text>
                </View>
              ) : (
                'Validate'
              )}
            </ThemedButton>
          </View>
        )}

        {/* Security Note */}
        <ThemedText style={STYLES.securityNote}>
          🔒 Your passphrase is processed locally and uses bank-level encryption
        </ThemedText>
      </View>
    </Animated.View>
  );
}