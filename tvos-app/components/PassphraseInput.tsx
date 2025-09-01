import React, { useState, useRef, useEffect } from 'react';
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

interface PassphraseInputProps {
  onSubmit: (
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ) => Promise<void>;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  accountName?: string;
  isVisible?: boolean;
}

export function PassphraseInput({
  onSubmit,
  onCancel,
  title = 'Enter Passphrase',
  subtitle = 'Please enter your 6-digit passphrase to continue',
  accountName,
  isVisible = true,
}: PassphraseInputProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Animation values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Input ref for focus management
  const inputRef = useRef<TextInput>(null);

  // Timer for elapsed seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && !showSuccess) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isProcessing, showSuccess]);

  // Auto-focus input when component becomes visible
  useEffect(() => {
    if (isVisible && !isProcessing) {
      // Delay focus to ensure component is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isVisible, isProcessing]);

  // Reset state when visibility changes
  useEffect(() => {
    if (isVisible) {
      setPassphrase('');
      setError(null);
      setShowSuccess(false);
      setProgress(0);
      setElapsedSeconds(0);
      setProgressMessage('');
      fadeAnim.setValue(1);
      successScale.setValue(0);
    }
  }, [isVisible]);

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const successAnimation = () => {
    Animated.spring(successScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleSubmit = async () => {
    if (!passphrase || passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters');
      shakeAnimation();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Starting validation...');

    try {
      // Pass progress callback to onSubmit
      await onSubmit(passphrase, (prog, msg) => {
        setProgress(Math.round(prog * 100));
        setProgressMessage(msg || `Processing... ${Math.round(prog * 100)}%`);
      });

      setProgress(100);
      setProgressMessage('Validation complete!');
      setShowSuccess(true);
      successAnimation();

      // Close after success animation
      setTimeout(() => {
        setIsProcessing(false);
        setShowSuccess(false);
        setProgress(0);
        setProgressMessage('');
      }, 2000);
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message || 'Invalid passphrase');
      setProgress(0);
      setProgressMessage('');
      shakeAnimation();
    }
  };

  const handleCancel = () => {
    if (!isProcessing && onCancel) {
      onCancel();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        padding: 40,
        transform: [{ translateX: shakeAnim }],
      }}
    >
      <View
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: 20,
          padding: 40,
          width: '100%',
          maxWidth: 600,
          minHeight: 400,
        }}
      >
        {/* Header */}
        <View style={{ marginBottom: 30, alignItems: 'center' }}>
          <ThemedText
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color: '#fff',
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            {title}
          </ThemedText>
          {accountName && (
            <ThemedText
              style={{
                color: '#888',
                fontSize: 18,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Account: {accountName}
            </ThemedText>
          )}
          <ThemedText
            style={{
              color: '#aaa',
              fontSize: 20,
              textAlign: 'center',
              lineHeight: 28,
            }}
          >
            {subtitle}
          </ThemedText>
        </View>

        {/* Input Field */}
        <View style={{ marginBottom: 30 }}>
          <TextInput
            ref={inputRef}
            value={passphrase}
            onChangeText={(text) => {
              setPassphrase(text);
              setError(null);
            }}
            placeholder="Enter your passphrase"
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isProcessing}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            blurOnSubmit={false}
            // tvOS specific styling
            style={{
              backgroundColor: '#2a2a2a',
              borderRadius: 12,
              padding: 20,
              fontSize: 24,
              color: '#fff',
              borderWidth: error ? 2 : 0,
              borderColor: error ? '#ff4444' : 'transparent',
              textAlign: 'center',
              letterSpacing: 2,
              // tvOS focus styling
              ...(Platform.isTV && {
                // Add focus indication for tvOS
                shadowColor: '#4a9eff',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 10,
              }),
            }}
            // tvOS specific props
            {...(Platform.isTV && {
              autoFocus: true,
              selectTextOnFocus: true,
            })}
          />
          {error && (
            <ThemedText
              style={{
                color: '#ff4444',
                fontSize: 18,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {error}
            </ThemedText>
          )}
        </View>

        {/* Progress Indicator */}
        {isProcessing && !showSuccess && (
          <View style={{ marginBottom: 30 }}>
            <View
              style={{
                height: 6,
                backgroundColor: '#333',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 15,
              }}
            >
              <Animated.View
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#4a9eff',
                  borderRadius: 3,
                }}
              />
            </View>
            <ThemedText
              style={{
                color: '#888',
                fontSize: 16,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {progressMessage || `Processing... ${progress}%`}
            </ThemedText>
            <ThemedText
              style={{
                color: '#666',
                fontSize: 14,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {elapsedSeconds}s elapsed
            </ThemedText>
            <ThemedText
              style={{
                color: '#555',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              Using 100,000 iterations for tvOS optimization
            </ThemedText>
          </View>
        )}

        {/* Success Animation */}
        {showSuccess && (
          <Animated.View
            style={{
              alignItems: 'center',
              marginBottom: 30,
              transform: [{ scale: successScale }],
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#00c851',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 15,
              }}
            >
              <Text style={{ fontSize: 40, color: '#fff' }}>✓</Text>
            </View>
            <ThemedText
              style={{
                color: '#00c851',
                fontSize: 24,
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              Passphrase Validated!
            </ThemedText>
          </Animated.View>
        )}

        {/* Action Buttons */}
        {!showSuccess && (
          <View
            style={{
              flexDirection: 'row',
              gap: 20,
              justifyContent: 'center',
            }}
          >
            {onCancel && (
              <ThemedButton
                onPress={handleCancel}
                disabled={isProcessing}
                style={{
                  backgroundColor: '#333',
                  paddingHorizontal: 40,
                  paddingVertical: 16,
                  borderRadius: 12,
                  opacity: isProcessing ? 0.5 : 1,
                  minWidth: 120,
                }}
                textStyle={{
                  color: '#fff',
                  fontSize: 20,
                  textAlign: 'center',
                }}
              >
                Cancel
              </ThemedButton>
            )}

            <ThemedButton
              onPress={handleSubmit}
              disabled={isProcessing || !passphrase}
              style={{
                backgroundColor: '#4a9eff',
                paddingHorizontal: 40,
                paddingVertical: 16,
                borderRadius: 12,
                opacity: isProcessing || !passphrase ? 0.7 : 1,
                minWidth: 160,
                // tvOS focus styling
                ...(Platform.isTV && {
                  shadowColor: '#4a9eff',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                }),
              }}
              textStyle={{
                color: '#fff',
                fontSize: 20,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {isProcessing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontSize: 20 }}>Processing</Text>
                </View>
              ) : (
                'Validate'
              )}
            </ThemedButton>
          </View>
        )}

        {/* Security Note */}
        <ThemedText
          style={{
            color: '#666',
            fontSize: 14,
            textAlign: 'center',
            marginTop: 20,
            lineHeight: 20,
          }}
        >
          🔒 Your passphrase is processed locally and uses bank-level encryption
        </ThemedText>
      </View>
    </Animated.View>
  );
}