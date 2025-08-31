import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import log from '@/lib/logging';
import { secureSession } from '@/lib/secure-session';

interface PassphrasePromptProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  message?: string;
}

export function PassphrasePrompt({
  visible,
  onClose,
  onSuccess,
  message = 'Please enter your passphrase to continue',
}: PassphrasePromptProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!passphrase || passphrase.length < 6) {
      Alert.alert(
        'Invalid Passphrase',
        'Passphrase must be at least 6 characters'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Store the passphrase securely
      await secureSession.setPassphrase(passphrase);
      log.info('[PassphrasePrompt] Passphrase stored successfully');

      // Clear the input
      setPassphrase('');

      // Notify success
      onSuccess();
    } catch (error) {
      log.error('[PassphrasePrompt] Error storing passphrase', { error });
      Alert.alert('Error', 'Failed to store passphrase. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPassphrase('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="m-4 max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
          <Text className="mb-2 text-xl font-bold text-neutral-900 dark:text-white">
            Passphrase Required
          </Text>

          <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            {message}
          </Text>

          <TextInput
            className="mb-4 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            placeholder="Enter your 6-digit passphrase"
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            keyboardType="numeric"
            maxLength={6}
            autoFocus
            editable={!isSubmitting}
          />

          <View className="flex-row gap-2">
            <TouchableOpacity
              className="flex-1 rounded-lg bg-neutral-200 px-4 py-3 dark:bg-neutral-700"
              onPress={handleCancel}
              disabled={isSubmitting}
            >
              <Text className="text-center font-medium text-neutral-900 dark:text-white">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3"
              onPress={handleSubmit}
              disabled={isSubmitting || !passphrase}
            >
              <Text className="text-center font-medium text-white">
                {isSubmitting ? 'Verifying...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
