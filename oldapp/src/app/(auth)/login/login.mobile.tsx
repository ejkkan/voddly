import { useRouter } from 'expo-router';
import React from 'react';
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

export default function LoginMobile() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = () => {
    console.log('Mobile login:', { email, password });
    signIn({ access: 'access-token', refresh: 'refresh-token' });
    router.push('/');
  };

  const handleSignup = () => {
    router.push('/signup');
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

          <View className="flex-1 justify-center px-6">
            {/* Logo/Brand Section */}
            <View className="mb-8 items-center">
              <Text className="text-4xl font-bold text-gray-900 dark:text-white">
                IPTV Test
              </Text>
              <Text className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                Mobile Experience
              </Text>
            </View>

            {/* Login Form */}
            <View className="space-y-4">
              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </Text>
                <Input
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
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
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  className="h-12"
                />
              </View>

              <TouchableOpacity className="self-end">
                <Text className="text-sm text-blue-600 dark:text-blue-400">
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <Button label="Sign In" onPress={handleLogin} className="mt-6" />

              <View className="mt-6 flex-row items-center justify-center">
                <Text className="text-gray-600 dark:text-gray-400">
                  Don't have an account?{' '}
                </Text>
                <TouchableOpacity onPress={handleSignup}>
                  <Text className="font-medium text-blue-600 dark:text-blue-400">
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Social Login Options */}
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
                    Continue with Google
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity className="flex-row items-center justify-center rounded-lg border border-gray-300 p-3 dark:border-gray-700">
                  <Text className="text-gray-700 dark:text-gray-300">
                    Continue with Apple
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
