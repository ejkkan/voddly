import { useRouter, Redirect } from 'expo-router';
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
import { Input } from '@/components/ui/input';
import { useSession } from '@/lib/auth/hooks';
import { apiClient } from '@/lib/api-client';
import { Shield } from '@/components/ui/icons/shield';

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
    if (passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user has an account
      const { account } = await apiClient.user.getAccount();

      if (!account) {
        // For new users, we need to create an account first
        // Let's create a minimal account just to set up encryption
        // The user will add sources later through the playlists page
        await apiClient.user.initializeNewAccount({
          accountName: `${session?.data?.user?.name || 'User'}'s Account`,
          passphrase,
        });
      } else {
        // Initialize encryption for existing account
        await apiClient.user.initializeAccountEncryption({ passphrase });
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
          const { account } = await apiClient.user.getAccount();

          if (!account) {
            // Use the existing createAccount with dummy data
            // This is a temporary source that can be removed later
            await apiClient.user.createAccount({
              accountName: `${session?.data?.user?.name || 'User'}'s Account`,
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
            await apiClient.user.initializeAccountEncryption({ passphrase });
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
              <View className="items-center mb-8">
                <View className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center mb-4">
                  <Shield className="w-10 h-10 text-neutral-600 dark:text-neutral-400" />
                </View>
                <Text className="text-3xl font-bold text-center mb-2 text-neutral-900 dark:text-neutral-100">
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
                    <Text className="text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                      Create Passphrase
                    </Text>
                    <Input
                      placeholder="Enter your passphrase"
                      value={passphrase}
                      onChangeText={setPassphrase}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <Text className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">
                      Minimum 6 characters. You'll need this to access your
                      sources.
                    </Text>
                  </View>

                  <View>
                    <Text className="text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
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
                    <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                      <Text className="text-red-600 dark:text-red-400 text-sm">
                        {error}
                      </Text>
                    </View>
                  ) : null}

                  <View className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    <Text className="text-amber-800 dark:text-amber-300 font-medium text-sm mb-1">
                      Important
                    </Text>
                    <Text className="text-amber-700 dark:text-amber-400 text-xs">
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
