import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { type FormType, LoginForm } from '@/components/login-form';
import {
  Button,
  Input,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import { useSession, useSignIn } from '@/lib/auth/hooks';
import { getDeviceInfo } from '@/lib/device-id';
import {
  initializeSecureStorage,
  secureClear,
  storeDeviceKeyData,
} from '@/lib/secure-storage';

export default function SignIn() {
  const { data: session } = useSession();
  const signIn = useSignIn();
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);
  const [isRegisteringDevice, setIsRegisteringDevice] = useState(false);
  const [needsDeviceRegistration, setNeedsDeviceRegistration] = useState(false);
  const [hasCompletedCheck, setHasCompletedCheck] = useState(false);
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{
    count: number;
    max: number;
  } | null>(null);

  // Only redirect if we're logged in AND we've completed the device check OR we're not showing the modal
  useEffect(() => {
    if (session?.data?.user && hasCompletedCheck && !showPassphraseModal) {
      router.replace('/(app)/dashboard');
    }
  }, [session, hasCompletedCheck, showPassphraseModal]);

  const handleDeviceRegistration = async () => {
    if (!passphrase) {
      Alert.alert('Error', 'Please enter your passphrase');
      return;
    }

    setIsRegisteringDevice(true);

    try {
      console.log('[SignIn] Getting account info for device registration');
      // Get the user's account (we're already signed in at this point)
      const subscriptions = await apiClient.user.getSubscriptions();
      const account = subscriptions.subscriptions?.[0];

      if (!account) {
        Alert.alert('Error', 'No account found');
        return;
      }

      // Register this device
      const deviceInfo = await getDeviceInfo();
      console.log('[SignIn] Registering device:', deviceInfo);

      const result = await apiClient.user.registerDevice({
        accountId: account.id,
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        deviceModel: deviceInfo.deviceModel,
        passphrase,
      });

      if (result.success) {
        console.log(
          '[SignIn] Device registered successfully with iterations:',
          result.iterations
        );

        // Store the device-specific key data securely
        storeDeviceKeyData(account.id, result.keyData);
        console.log('[SignIn] Device key data stored securely');

        setShowPassphraseModal(false);
        setPassphrase('');
        setNeedsDeviceRegistration(false);
        setHasCompletedCheck(true);

        // Navigate to dashboard
        console.log(
          '[SignIn] Redirecting to dashboard after device registration'
        );
        router.replace('/(app)/dashboard');
      } else {
        Alert.alert('Error', 'Failed to register device');
      }
    } catch (error: any) {
      console.error('[SignIn] Device registration error:', error);
      
      // Parse different types of device registration errors
      if (error.message?.includes('Invalid passphrase')) {
        Alert.alert(
          'Invalid Passphrase',
          'The passphrase you entered is incorrect. Please try again.'
        );
        setPassphrase('');
      } else if (error.message?.includes('Device limit exceeded')) {
        // Device limit was reached during registration
        setDeviceLimitExceeded(true);
        setShowPassphraseModal(false);
        setPassphrase('');
        setNeedsDeviceRegistration(false);
      } else if (error.message?.includes('Account not found')) {
        Alert.alert(
          'Account Error',
          'Your account could not be found. Please sign in again.'
        );
        router.replace('/signin');
      } else if (error.message?.includes('Account encryption not found')) {
        Alert.alert(
          'Setup Required',
          'Your account needs to be set up with encryption first.'
        );
        router.replace('/passphrase-setup');
      } else {
        // Generic error with more context
        const errorMsg = error.message || 'Failed to register device';
        Alert.alert(
          'Device Registration Failed',
          `${errorMsg}. Please try again or contact support if the problem persists.`
        );
      }
    } finally {
      setIsRegisteringDevice(false);
    }
  };

  const handleSubmit = async (data: FormType) => {
    console.log('[SignIn] Starting login process');
    setIsCheckingDevice(true);
    setHasCompletedCheck(false);

    try {
      // Sign in to get authenticated
      console.log('[SignIn] Attempting authentication...');
      await signIn.mutateAsync({
        email: data.email,
        password: data.password,
      });

      console.log('[SignIn] Authentication completed, waiting for session...');

      // Wait a moment for the session to be established
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('[SignIn] Fetching account info...');
      // Get the user's account
      const subscriptions = await apiClient.user.getSubscriptions();
      const account = subscriptions.subscriptions?.[0];
      console.log('[SignIn] Account fetched:', account?.id);

      // Initialize secure storage with user session
      if (account?.id) {
        initializeSecureStorage(account.id, Date.now());
        console.log('[SignIn] Secure storage initialized');
      }

      if (!account) {
        // No account yet, go to setup
        console.log('[SignIn] No account found, redirecting to setup');
        setHasCompletedCheck(true);
        router.replace('/');
        return;
      }

      // Check if account has encryption
      console.log('[SignIn] Checking account encryption...');
      const accountInfo = await apiClient.user.getSubscription();
      console.log(
        '[SignIn] Account has encryption:',
        accountInfo.hasEncryption
      );

      if (!accountInfo.hasEncryption) {
        // No encryption setup yet, proceed to setup
        console.log(
          '[SignIn] No encryption setup, redirecting to passphrase setup'
        );
        setHasCompletedCheck(true);
        router.replace('/passphrase-setup');
        return;
      }

      // Check if this device is registered
      const deviceInfo = await getDeviceInfo();
      console.log('[SignIn] Checking device:', deviceInfo.deviceId);

      try {
        const deviceCheck = await apiClient.user.checkDevice({
          accountId: account.id,
          deviceId: deviceInfo.deviceId,
        });

        console.log('[SignIn] Device check result:', deviceCheck);

        // Store device info for display
        if (
          deviceCheck.deviceCount !== undefined &&
          deviceCheck.maxDevices !== undefined
        ) {
          setDeviceInfo({
            count: deviceCheck.deviceCount,
            max: deviceCheck.maxDevices,
          });
        }

        if (deviceCheck.isRegistered) {
          // Device is already registered
          console.log('[SignIn] Device already registered, fetching key data');

          // For existing devices, we can fetch the key data if needed
          try {
            const keyData = await apiClient.user.getDeviceKey({
              accountId: account.id,
              deviceId: deviceInfo.deviceId,
            });

            // Store securely for future use
            storeDeviceKeyData(account.id, keyData.keyData);

            console.log(
              '[SignIn] Device key data stored, redirecting to dashboard'
            );
          } catch (error) {
            console.warn('[SignIn] Could not fetch device key data:', error);
          }

          setHasCompletedCheck(true);
          // Proceed to dashboard
          router.replace('/(app)/dashboard');
        } else if (
          deviceCheck.canAutoRegister &&
          deviceCheck.requiresPassphrase
        ) {
          // Device not registered but can be added
          console.log('[SignIn] New device detected, requesting passphrase');
          setNeedsDeviceRegistration(true);
          setShowPassphraseModal(true);
        } else if (!deviceCheck.canAutoRegister) {
          // Device limit exceeded
          console.log('[SignIn] Device limit exceeded:', deviceCheck.message);
          setDeviceLimitExceeded(true);
        } else {
          // This shouldn't happen if hasEncryption is true
          console.log(
            '[SignIn] Unexpected state - has encryption but no passphrase required'
          );
          setHasCompletedCheck(true);
          router.replace('/(app)/dashboard');
        }
      } catch (error: any) {
        console.error('[SignIn] Device check error:', error);
        console.error('[SignIn] Error details:', error.message, error.stack);
        
        // Parse device check errors for better user experience
        if (error.message?.includes('Device limit exceeded')) {
          setDeviceLimitExceeded(true);
        } else if (error.message?.includes('Account not found')) {
          Alert.alert(
            'Account Error',
            'Your account could not be found. Please sign in again.'
          );
          router.replace('/signin');
          return;
        } else if (error.status === 401 || error.message?.includes('Unauthorized')) {
          Alert.alert(
            'Authentication Error',
            'Your session has expired. Please sign in again.'
          );
          router.replace('/signin');
          return;
        } else {
          // For other errors, show a generic message but still try to continue
          console.warn('[SignIn] Device check failed, proceeding with caution');
          Alert.alert(
            'Device Check Warning',
            'Unable to verify device status. Some features may be limited.',
            [{ text: 'Continue', onPress: () => {
              setHasCompletedCheck(true);
              router.replace('/(app)/dashboard');
            }}]
          );
        }
      }
    } catch (error: any) {
      console.error('[SignIn] Sign in error:', error);
      
      // Parse signin errors for better user experience
      let title = 'Sign In Failed';
      let message = 'Failed to sign in';
      
      if (error.message?.includes('Invalid email or password')) {
        title = 'Invalid Credentials';
        message = 'The email or password you entered is incorrect. Please try again.';
      } else if (error.message?.includes('User not found')) {
        title = 'Account Not Found';
        message = 'No account found with this email address. Please check your email or create a new account.';
      } else if (error.message?.includes('Too many requests')) {
        title = 'Too Many Attempts';
        message = 'Too many sign-in attempts. Please wait a few minutes before trying again.';
      } else if (error.status === 429) {
        title = 'Rate Limited';
        message = 'Too many requests. Please wait before trying again.';
      } else if (error.message?.includes('Network')) {
        title = 'Connection Error';
        message = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (error.message) {
        message = error.message;
      }
      
      Alert.alert(title, message);
    } finally {
      setIsCheckingDevice(false);
    }
  };

  // Device limit exceeded modal
  if (deviceLimitExceeded) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-white p-6 dark:bg-black">
          <View className="mx-auto w-full max-w-md">
            <Text className="mb-2 text-2xl font-bold text-red-600 dark:text-red-400">
              Device Limit Reached
            </Text>
            <Text className="mb-4 text-gray-600 dark:text-gray-400">
              You've reached the maximum number of devices{' '}
              {deviceInfo?.max ? `(${deviceInfo.count}/${deviceInfo.max})` : ''} 
              {' '}for your account.
            </Text>
            <Text className="mb-4 text-gray-600 dark:text-gray-400">
              To use this device, you'll need to:
            </Text>
            <View className="mb-6">
              <Text className="mb-2 text-gray-600 dark:text-gray-400">
                • Remove an unused device from your account settings, or
              </Text>
              <Text className="mb-2 text-gray-600 dark:text-gray-400">
                • Upgrade your plan to allow more devices
              </Text>
            </View>

            <Button
              label="Manage Devices"
              onPress={() => {
                setDeviceLimitExceeded(false);
                setHasCompletedCheck(true);
                router.replace('/(app)/settings/devices');
              }}
              className="mb-2"
            />

            <Button
              label="View Plans"
              onPress={() => {
                setDeviceLimitExceeded(false);
                setHasCompletedCheck(true);
                router.replace('/(app)/settings/subscription');
              }}
              variant="outline"
              className="mb-2"
            />

            <Button
              label="Sign Out"
              onPress={() => {
                setDeviceLimitExceeded(false);
                router.replace('/signin');
              }}
              variant="secondary"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Passphrase modal for device registration
  if (showPassphraseModal) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-white p-6 dark:bg-black">
          <View className="mx-auto w-full max-w-md">
            <Text className="mb-2 text-2xl font-bold dark:text-white">
              {needsDeviceRegistration
                ? 'New Device Detected'
                : 'Enter Passphrase'}
            </Text>
            <Text className="mb-6 text-gray-600 dark:text-gray-400">
              {needsDeviceRegistration
                ? "We noticed you're signing in from a new device. Please enter your passphrase to securely access your account on this device."
                : 'Please enter your passphrase to access your encrypted data.'}
            </Text>

            <Input
              placeholder="Enter your passphrase"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              className="mb-4"
              autoFocus
            />

            <Button
              label={isRegisteringDevice ? 'Registering Device...' : 'Continue'}
              onPress={handleDeviceRegistration}
              disabled={!passphrase || isRegisteringDevice}
              className="mb-2"
            />

            <Button
              label="Cancel"
              onPress={() => {
                setShowPassphraseModal(false);
                setPassphrase('');
                setNeedsDeviceRegistration(false);
                // Clear secure storage on cancel
                secureClear();
                // Sign out since we can't proceed without device registration
                router.replace('/signin');
              }}
              variant="secondary"
              disabled={isRegisteringDevice}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
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
            <View className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <LoginForm
                onSubmit={handleSubmit}
                loading={signIn.isPending || isCheckingDevice}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
