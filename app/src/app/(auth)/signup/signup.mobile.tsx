import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
  Input,
} from '@/components/ui';
import { useAuth } from '@/lib';

export default function SignupMobile() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSignup = () => {
    console.log('Mobile signup:', formData);
    // In real app, would call signup API
    signIn({ access: 'access-token', refresh: 'refresh-token' });
    router.push('/');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
          <FocusAwareStatusBar />

          <View className="flex-1 px-6 py-8">
            {/* Header */}
            <View className="mb-8">
              <Text className="text-3xl font-bold text-gray-900 dark:text-white">
                Create Account
              </Text>
              <Text className="mt-2 text-gray-600 dark:text-gray-400">
                Join IPTV Test Mobile
              </Text>
            </View>

            {/* Signup Form */}
            <View className="space-y-4">
              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </Text>
                <Input
                  placeholder="John Doe"
                  value={formData.name}
                  onChangeText={(value) => updateField('name', value)}
                  autoCapitalize="words"
                  className="h-12"
                />
              </View>

              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </Text>
                <Input
                  placeholder="you@example.com"
                  value={formData.email}
                  onChangeText={(value) => updateField('email', value)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="h-12"
                />
              </View>

              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </Text>
                <Input
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChangeText={(value) => updateField('password', value)}
                  secureTextEntry
                  className="h-12"
                />
              </View>

              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </Text>
                <Input
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChangeText={(value) =>
                    updateField('confirmPassword', value)
                  }
                  secureTextEntry
                  className="h-12"
                />
              </View>

              <View className="mt-2">
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  By signing up, you agree to our Terms of Service and Privacy
                  Policy
                </Text>
              </View>

              <Button
                label="Create Account"
                onPress={handleSignup}
                className="mt-6"
              />

              <View className="mt-6 flex-row items-center justify-center">
                <Text className="text-gray-600 dark:text-gray-400">
                  Already have an account?{' '}
                </Text>
                <TouchableOpacity onPress={handleLogin}>
                  <Text className="font-medium text-blue-600 dark:text-blue-400">
                    Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Social Signup */}
            <View className="mt-8">
              <View className="flex-row items-center">
                <View className="h-px flex-1 bg-gray-300 dark:bg-gray-700" />
                <Text className="mx-4 text-gray-500 dark:text-gray-400">
                  OR
                </Text>
                <View className="h-px flex-1 bg-gray-300 dark:bg-gray-700" />
              </View>

              <View className="mt-4 space-y-3">
                <TouchableOpacity className="flex-row items-center justify-center rounded-lg border border-gray-300 p-3 dark:border-gray-700">
                  <Text className="text-gray-700 dark:text-gray-300">
                    Sign up with Google
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity className="flex-row items-center justify-center rounded-lg border border-gray-300 p-3 dark:border-gray-700">
                  <Text className="text-gray-700 dark:text-gray-300">
                    Sign up with Apple
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
