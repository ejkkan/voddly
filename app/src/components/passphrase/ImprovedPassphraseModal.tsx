import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface PassphraseModalProps {
  visible: boolean;
  title: string;
  message: string;
  accountName?: string;
  onSubmit: (
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ) => Promise<void>;
  onCancel: () => void;
}

export function ImprovedPassphraseModal({
  visible,
  title,
  message,
  accountName,
  onSubmit,
  onCancel,
}: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Animation values
  const shakeAnim = new Animated.Value(0);
  const successScale = new Animated.Value(0);
  const progressAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      setPassphrase('');
      setError(null);
      setShowSuccess(false);
      setProgress(0);
      setElapsedSeconds(0);
    }
  }, [visible]);

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
    setProgressMessage('Starting decryption...');

    try {
      // Pass progress callback to onSubmit
      await onSubmit(passphrase, (prog, msg) => {
        setProgress(Math.round(prog * 100));
        setProgressMessage(msg || `Processing... ${Math.round(prog * 100)}%`);
      });

      setProgress(100);
      setProgressMessage('Decryption complete!');
      setShowSuccess(true);
      successAnimation();

      // Close modal after success animation
      setTimeout(() => {
        setIsProcessing(false);
        setShowSuccess(false);
        setProgress(0);
        setProgressMessage('');
      }, 1500);
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message || 'Invalid passphrase');
      setProgress(0);
      setProgressMessage('');
      shakeAnimation();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            // Only dismiss keyboard if tapping outside the modal content
            Keyboard.dismiss();
          }}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Animated.View
            onStartShouldSetResponder={() => true}
            onResponderRelease={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              transform: [{ translateX: shakeAnim }],
            }}
          >
            {/* Header */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                {title}
              </Text>
              {accountName && (
                <Text style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>
                  Account: {accountName}
                </Text>
              )}
              <Text style={{ color: '#aaa', fontSize: 16 }}>{message}</Text>
            </View>

            {/* Input Field */}
            <View style={{ marginBottom: 20 }}>
              <TextInput
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
                autoFocus={true}
                editable={!isProcessing}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
                blurOnSubmit={false}
                style={{
                  backgroundColor: '#2a2a2a',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: '#fff',
                  borderWidth: error ? 1 : 0,
                  borderColor: error ? '#ff4444' : 'transparent',
                }}
              />
              {error && (
                <Text
                  style={{
                    color: '#ff4444',
                    fontSize: 14,
                    marginTop: 8,
                  }}
                >
                  {error}
                </Text>
              )}
            </View>

            {/* Progress Indicator */}
            {isProcessing && !showSuccess && (
              <View style={{ marginBottom: 20 }}>
                <View
                  style={{
                    height: 4,
                    backgroundColor: '#333',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      backgroundColor: '#4a9eff',
                      borderRadius: 2,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: '#888',
                    fontSize: 12,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  {progressMessage || `Deriving encryption key (${progress}%)`}{' '}
                  • {elapsedSeconds}s elapsed
                </Text>
                <Text
                  style={{
                    color: '#666',
                    fontSize: 10,
                    marginTop: 4,
                    textAlign: 'center',
                  }}
                >
                  Using 500,000 iterations for maximum security
                </Text>
              </View>
            )}

            {/* Success Animation */}
            {showSuccess && (
              <Animated.View
                style={{
                  alignItems: 'center',
                  marginBottom: 20,
                  transform: [{ scale: successScale }],
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: '#00c851',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 30, color: '#fff' }}>✓</Text>
                </View>
                <Text
                  style={{
                    color: '#00c851',
                    fontSize: 16,
                    marginTop: 12,
                  }}
                >
                  Decryption successful!
                </Text>
              </Animated.View>
            )}

            {/* Action Buttons */}
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={onCancel}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  backgroundColor: '#333',
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isProcessing || !passphrase}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: isProcessing || !passphrase ? 0.7 : 1,
                }}
              >
                <LinearGradient
                  colors={['#4a9eff', '#0066ff']}
                  style={{
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: '600',
                      }}
                    >
                      Decrypt
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Security Note */}
            <Text
              style={{
                color: '#666',
                fontSize: 11,
                textAlign: 'center',
                marginTop: 16,
              }}
            >
              🔒 Your passphrase is never stored and uses bank-level encryption
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
