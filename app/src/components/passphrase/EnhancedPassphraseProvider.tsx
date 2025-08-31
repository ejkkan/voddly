import { LinearGradient } from 'expo-linear-gradient';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
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

import { apiClient } from '@/lib/api-client';
import { deriveLightweightKeyChunked } from '@/lib/crypto-chunked';
import { aesGcmDecrypt, decodeBase64 } from '@/lib/crypto-utils';
import { passphraseCache } from '@/lib/passphrase-cache';
import { registerPassphraseResolver } from '@/lib/passphrase-ui';

type DecryptionState = {
  visible: boolean;
  title: string;
  message: string;
  accountId?: string;
  accountName?: string;
  passphrase: string;
  isProcessing: boolean;
  error: string | null;
  progress: number;
  progressMessage: string;
  elapsedSeconds: number;
  showSuccess: boolean;
  resolve?: (value: string) => void;
  reject?: (reason?: any) => void;
};

const PassphraseContext = createContext<{
  requestPassphrase: (args: {
    accountId: string;
    title?: string;
    message?: string;
    accountName?: string;
    validateWithDecryption?: boolean;
  }) => Promise<string>;
} | null>(null);

export function useEnhancedPassphraseUI() {
  const ctx = useContext(PassphraseContext);
  if (!ctx) throw new Error('EnhancedPassphraseProvider missing');
  return ctx;
}

export function EnhancedPassphraseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<DecryptionState>({
    visible: false,
    title: 'Decrypt Source',
    message: 'Enter your passphrase to decrypt',
    passphrase: '',
    isProcessing: false,
    error: null,
    progress: 0,
    progressMessage: '',
    elapsedSeconds: 0,
    showSuccess: false,
  });

  const timerRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Update elapsed time during processing
  React.useEffect(() => {
    if (state.isProcessing && !state.showSuccess) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedSeconds: Math.floor(
            (Date.now() - startTimeRef.current) / 1000
          ),
        }));
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isProcessing, state.showSuccess]);

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

  const performActualDecryption = async (
    accountId: string,
    passphrase: string,
    onProgress: (progress: number, message?: string) => void
  ): Promise<void> => {
    // Get encryption data from the server
    const encData = await apiClient.user.getEncryptionData(accountId);

    if (!encData || !encData.keyData) {
      throw new Error('No encryption data found for account');
    }

    const { keyData } = encData;
    const salt = decodeBase64(String(keyData.salt || ''));
    const iv = decodeBase64(String(keyData.iv || ''));
    const wrapped = decodeBase64(String(keyData.master_key_wrapped || ''));

    // Validate data
    if (salt.length === 0) throw new Error('Invalid key data: missing salt');
    if (iv.length === 0) throw new Error('Invalid key data: missing IV');
    if (wrapped.length === 0)
      throw new Error('Invalid key data: missing wrapped key');

    const iterations = keyData.kdf_iterations || keyData.iterations || 100000;

    // Derive the key with progress updates
    onProgress(
      0,
      `Starting key derivation (${iterations.toLocaleString()} iterations)`
    );

    const personalKeyBytes = await deriveLightweightKeyChunked(
      passphrase,
      salt,
      iterations,
      (progress, msg) => {
        // Scale progress to 0-90% (key derivation is most of the work)
        onProgress(
          progress * 0.9,
          msg || `Deriving key... ${Math.round(progress * 100)}%`
        );
      }
    );

    // Decrypt the master key
    onProgress(0.95, 'Decrypting master key...');

    try {
      const masterKeyBytes = aesGcmDecrypt(personalKeyBytes, iv, wrapped);

      // Success!
      onProgress(1, 'Decryption complete');

      // Cache the passphrase for future use
      passphraseCache.set(accountId, passphrase);
    } catch (error) {
      throw new Error('Invalid passphrase - decryption failed');
    }
  };

  const handleSubmit = useCallback(async () => {
    const { passphrase, accountId, resolve, reject } = state;

    if (!passphrase || passphrase.length < 6) {
      setState((prev) => ({
        ...prev,
        error: 'Passphrase must be at least 6 characters',
      }));
      shakeAnimation();
      return;
    }

    if (!accountId || !resolve || !reject) return;

    setState((prev) => ({
      ...prev,
      isProcessing: true,
      error: null,
      progress: 0,
      progressMessage: 'Starting decryption...',
      elapsedSeconds: 0,
    }));

    try {
      // Perform the actual decryption with progress updates
      await performActualDecryption(
        accountId,
        passphrase,
        (progress, message) => {
          setState((prev) => ({
            ...prev,
            progress: Math.round(progress * 100),
            progressMessage:
              message || `Processing... ${Math.round(progress * 100)}%`,
          }));
        }
      );

      // Show success animation
      setState((prev) => ({ ...prev, showSuccess: true, progress: 100 }));
      successAnimation();

      // Resolve with the passphrase
      resolve(passphrase);

      // Close modal after success animation
      setTimeout(() => {
        setState({
          visible: false,
          title: 'Decrypt Source',
          message: 'Enter your passphrase to decrypt',
          passphrase: '',
          isProcessing: false,
          error: null,
          progress: 0,
          progressMessage: '',
          elapsedSeconds: 0,
          showSuccess: false,
        });
      }, 1500);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Invalid passphrase',
        progress: 0,
        progressMessage: '',
      }));
      shakeAnimation();
    }
  }, [state]);

  const handleCancel = useCallback(() => {
    if (state.reject) {
      state.reject(new Error('User cancelled passphrase input'));
    }
    setState({
      visible: false,
      title: 'Decrypt Source',
      message: 'Enter your passphrase to decrypt',
      passphrase: '',
      isProcessing: false,
      error: null,
      progress: 0,
      progressMessage: '',
      elapsedSeconds: 0,
      showSuccess: false,
    });
  }, [state]);

  const requestPassphrase = useCallback(
    ({
      accountId,
      title,
      message,
      accountName,
      validateWithDecryption = true,
    }: {
      accountId: string;
      title?: string;
      message?: string;
      accountName?: string;
      validateWithDecryption?: boolean;
    }) => {
      // Check cache first
      const cached = passphraseCache.get(accountId);
      if (cached && !validateWithDecryption) {
        return Promise.resolve(cached);
      }

      return new Promise<string>((resolve, reject) => {
        setState({
          visible: true,
          title: title || 'Decrypt Source',
          message: message || 'Enter your passphrase to decrypt',
          accountId,
          accountName,
          passphrase: '',
          isProcessing: false,
          error: null,
          progress: 0,
          progressMessage: '',
          elapsedSeconds: 0,
          showSuccess: false,
          resolve,
          reject,
        });
      });
    },
    []
  );

  // Register global resolver
  React.useEffect(() => {
    const fn = async (
      accountId: string,
      options?: { title?: string; message?: string; accountName?: string }
    ) =>
      requestPassphrase({
        accountId,
        title: options?.title,
        message: options?.message,
        accountName: options?.accountName,
      });
    registerPassphraseResolver(fn);
    return () => registerPassphraseResolver(null);
  }, [requestPassphrase]);

  const context = useMemo(() => ({ requestPassphrase }), [requestPassphrase]);

  return (
    <PassphraseContext.Provider value={context}>
      {children}

      {/* Enhanced Modal with Progress */}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
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
                  {state.title}
                </Text>
                {state.accountName && (
                  <Text
                    style={{ color: '#888', fontSize: 14, marginBottom: 4 }}
                  >
                    Account: {state.accountName}
                  </Text>
                )}
                <Text style={{ color: '#aaa', fontSize: 16 }}>
                  {state.message}
                </Text>
              </View>

              {/* Input Field - Hidden during processing */}
              {!state.isProcessing && (
                <View style={{ marginBottom: 20 }}>
                  <TextInput
                    value={state.passphrase}
                    onChangeText={(text) => {
                      setState((prev) => ({
                        ...prev,
                        passphrase: text,
                        error: null,
                      }));
                    }}
                    placeholder="Enter your passphrase"
                    placeholderTextColor="#666"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={true}
                    editable={!state.isProcessing}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                    style={{
                      backgroundColor: '#2a2a2a',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: '#fff',
                      borderWidth: state.error ? 1 : 0,
                      borderColor: state.error ? '#ff4444' : 'transparent',
                    }}
                  />
                  {state.error && (
                    <Text
                      style={{
                        color: '#ff4444',
                        fontSize: 14,
                        marginTop: 8,
                      }}
                    >
                      {state.error}
                    </Text>
                  )}
                </View>
              )}

              {/* Progress Indicator */}
              {state.isProcessing && !state.showSuccess && (
                <View style={{ marginBottom: 20 }}>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: '#333',
                      borderRadius: 3,
                      overflow: 'hidden',
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${state.progress}%`,
                        backgroundColor: '#4a9eff',
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 14,
                      marginBottom: 4,
                      textAlign: 'center',
                    }}
                  >
                    {state.progressMessage}
                  </Text>
                  <Text
                    style={{
                      color: '#888',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {state.progress}% complete • {state.elapsedSeconds}s elapsed
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      fontSize: 10,
                      marginTop: 4,
                      textAlign: 'center',
                    }}
                  >
                    Processing 500,000 iterations for maximum security
                  </Text>
                </View>
              )}

              {/* Success Animation */}
              {state.showSuccess && (
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
                  <Text
                    style={{
                      color: '#888',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Completed in {state.elapsedSeconds} seconds
                  </Text>
                </Animated.View>
              )}

              {/* Action Buttons */}
              {!state.isProcessing && (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={handleCancel}
                    style={{
                      flex: 1,
                      backgroundColor: '#333',
                      borderRadius: 12,
                      padding: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!state.passphrase}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      overflow: 'hidden',
                      opacity: !state.passphrase ? 0.7 : 1,
                    }}
                  >
                    <LinearGradient
                      colors={['#4a9eff', '#0066ff']}
                      style={{
                        padding: 16,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 16,
                          fontWeight: '600',
                        }}
                      >
                        Decrypt
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Security Note */}
              <Text
                style={{
                  color: '#666',
                  fontSize: 11,
                  textAlign: 'center',
                  marginTop: 16,
                }}
              >
                🔒 Your passphrase is never stored and uses bank-level
                encryption
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </PassphraseContext.Provider>
  );
}
