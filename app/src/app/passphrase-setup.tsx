import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Shield } from '@/components/ui/icons/shield';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useSession } from '@/lib/auth/hooks';
import { DeviceManager } from '@/lib/device-manager';
import { secureSession } from '@/lib/secure-session';

export default function PassphraseSetup() {
  const router = useRouter();
  const { data: session, isLoading: sessionLoading } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    // Validate passphrase
    if (passphrase.length !== 6 || !/^\d{6}$/.test(passphrase)) {
      setError('Passphrase must be exactly 6 digits');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Store passphrase securely for future use
      await secureSession.setPassphrase(passphrase);

      // Get device info for registration
      const deviceManager = DeviceManager.getInstance();
      const deviceInfo = await deviceManager.getDeviceInfo();

      // Check if user has an account
      const { subscription: account } = await apiClient.user.getSubscription();

      if (!account) {
        // For new users, we need to create an account first
        // Let's create a minimal account just to set up encryption
        // The user will add sources later through the playlists page
        const result = await apiClient.user.initializeSubscription({
          passphrase,
        });

        // Register device after account creation
        if (result.subscriptionId) {
          try {
            await apiClient.user.registerDevice({
              accountId: result.subscriptionId,
              deviceId: deviceInfo.deviceId,
              deviceType: deviceInfo.deviceType,
              deviceName: deviceInfo.deviceName,
              deviceModel: deviceInfo.deviceModel,
              passphrase,
            });
            console.log('[PassphraseSetup] Device registered successfully');
            // Mark device as registered for this account
            await secureSession.setDeviceRegistered(
              true,
              result.subscriptionId
            );
          } catch (err) {
            console.log('[PassphraseSetup] Device registration failed:', err);
            // Continue anyway - device can be registered later
          }
        }
      } else {
        // Account exists - either initialize encryption or register device
        try {
          // Use the new one-time setup endpoint
          await apiClient.user.setupPassphrase({
            passphrase,
            deviceId: deviceInfo.deviceId,
            deviceType: deviceInfo.deviceType,
            deviceName: deviceInfo.deviceName,
            deviceModel: deviceInfo.deviceModel,
          });
          console.log('[PassphraseSetup] Passphrase and device setup complete');
          // Mark device as registered for this account
          await secureSession.setDeviceRegistered(true, account.id);
        } catch (error: any) {
          // If it fails, it might be because passphrase was already set
          if (error?.message?.includes('already')) {
            console.log(
              '[PassphraseSetup] Passphrase already set, trying to register device'
            );
            // Try to just register the device
            await apiClient.user.registerDevice({
              accountId: account.id,
              deviceId: deviceInfo.deviceId,
              deviceType: deviceInfo.deviceType,
              deviceName: deviceInfo.deviceName,
              deviceModel: deviceInfo.deviceModel,
              passphrase,
            });
            await secureSession.setDeviceRegistered(true, account.id);
          } else {
            throw error;
          }
        }
      }

      // Navigate to main app
      router.replace('/(app)');
    } catch (error: any) {
      console.error('Failed to set up passphrase:', error);

      // If initializeNewAccount doesn't exist, fall back to the old method
      if (
        error?.message?.includes('not found') ||
        error?.code === 'not_found'
      ) {
        try {
          // Check if user has an account again
          const { subscription: account } =
            await apiClient.user.getSubscription();

          if (!account) {
            // Use the existing createAccount with dummy data
            // This is a temporary source that can be removed later
            await apiClient.user.createSubscription({
              sourceName: 'Setup',
              providerType: 'xtream',
              credentials: {
                server: 'placeholder',
                username: 'placeholder',
                password: 'placeholder',
              },
              passphrase,
            });
          } else {
            // Get device info for registration (if not already done)
            const deviceManager = DeviceManager.getInstance();
            const deviceInfo = await deviceManager.getDeviceInfo();

            await apiClient.user.initializeSubscriptionEncryption({
              passphrase,
              deviceId: deviceInfo.deviceId,
              deviceType: deviceInfo.deviceType,
              deviceName: deviceInfo.deviceName,
              deviceModel: deviceInfo.deviceModel,
            });
          }

          router.replace('/(app)');
        } catch (fallbackError: any) {
          setError(fallbackError?.message || 'Failed to set up encryption');
        }
      } else {
        setError(error?.message || 'Failed to set up encryption');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking session
  if (sessionLoading) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center bg-white dark:bg-black">
          <Text className="text-neutral-600 dark:text-neutral-400">
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Redirect to signin if not logged in
  if (!session?.data?.user) {
    return <Redirect href="/signin" />;
  }

  return (
    <SafeAreaView className="flex-1">
      <FocusAwareStatusBar />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={10}
      >
        <View className="flex-1 bg-white dark:bg-black">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <View className="mx-auto w-full max-w-md">
              {/* Icon and Title */}
              <View className="mb-8 items-center">
                <View className="mb-4 size-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <Shield className="size-10 text-neutral-600 dark:text-neutral-400" />
                </View>
                <Text className="mb-2 text-center text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                  Secure Your Content
                </Text>
                <Text className="text-center text-neutral-600 dark:text-neutral-400">
                  Set up your encryption passphrase to protect your streaming
                  sources
                </Text>
              </View>

              {/* Form */}
              <View className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <View className="gap-4">
                  <View>
                    <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Create Passphrase
                    </Text>
                    <Input
                      placeholder="Enter your passphrase"
                      value={passphrase}
                      onChangeText={setPassphrase}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Minimum 6 characters. You'll need this to access your
                      sources.
                    </Text>
                  </View>

                  <View>
                    <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Confirm Passphrase
                    </Text>
                    <Input
                      placeholder="Confirm your passphrase"
                      value={confirmPassphrase}
                      onChangeText={setConfirmPassphrase}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  {error ? (
                    <View className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                      <Text className="text-sm text-red-600 dark:text-red-400">
                        {error}
                      </Text>
                    </View>
                  ) : null}

                  <View className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <Text className="mb-1 text-sm font-medium text-amber-800 dark:text-amber-300">
                      Important
                    </Text>
                    <Text className="text-xs text-amber-700 dark:text-amber-400">
                      Remember this passphrase! It cannot be recovered if lost.
                      You'll need it to decrypt your streaming sources.
                    </Text>
                  </View>

                  <Button
                    label={isSubmitting ? 'Setting up...' : 'Continue'}
                    onPress={handleSubmit}
                    disabled={isSubmitting || !passphrase || !confirmPassphrase}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
