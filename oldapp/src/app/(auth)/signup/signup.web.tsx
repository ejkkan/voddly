import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Button, Text, View, Input } from '@/components/ui';
import { useAuth } from '@/lib';

export default function SignupWeb() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  const handleSignup = (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log('Web signup:', formData);
    signIn({ access: 'access-token', refresh: 'refresh-token' });
    router.push('/');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View className="flex min-h-screen flex-row">
      {/* Left Panel - Branding */}
      <View className="hidden flex-1 items-center justify-center bg-gradient-to-br from-purple-600 to-blue-700 lg:flex">
        <View className="px-12 text-center">
          <Text className="text-5xl font-bold text-white">Join IPTV Test</Text>
          <Text className="mt-4 text-xl text-white/90">Desktop Experience</Text>
          <View className="mt-12 space-y-4 text-left">
            <View className="flex items-start">
              <Text className="text-2xl">✓</Text>
              <Text className="ml-3 text-lg text-white/90">
                Access thousands of live channels
              </Text>
            </View>
            <View className="flex items-start">
              <Text className="text-2xl">✓</Text>
              <Text className="ml-3 text-lg text-white/90">
                Watch on-demand movies and series
              </Text>
            </View>
            <View className="flex items-start">
              <Text className="text-2xl">✓</Text>
              <Text className="ml-3 text-lg text-white/90">
                Multi-device streaming support
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Right Panel - Signup Form */}
      <View className="flex flex-1 items-center justify-center bg-white px-8 dark:bg-gray-900">
        <View className="w-full max-w-md">
          {/* Mobile Logo (shown on smaller screens) */}
          <View className="mb-8 text-center lg:hidden">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white">
              IPTV Test
            </Text>
          </View>

          <Text className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Create your account
          </Text>
          <Text className="mb-8 text-gray-600 dark:text-gray-400">
            Start streaming in less than a minute
          </Text>

          <form onSubmit={handleSignup} className="space-y-5">
            <View>
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Full Name
              </Text>
              <Input
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                autoComplete="name"
                required
                className="h-11 w-full"
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </Text>
              <Input
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                autoComplete="email"
                required
                className="h-11 w-full"
              />
            </View>

            <View className="grid grid-cols-2 gap-4">
              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </Text>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChangeText={(value) => updateField('password', value)}
                  autoComplete="new-password"
                  required
                  className="h-11 w-full"
                />
              </View>

              <View>
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </Text>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChangeText={(value) =>
                    updateField('confirmPassword', value)
                  }
                  autoComplete="new-password"
                  required
                  className="h-11 w-full"
                />
              </View>
            </View>

            <View className="flex items-start">
              <input
                type="checkbox"
                id="agree-terms"
                checked={formData.agreeToTerms}
                onChange={(e) => updateField('agreeToTerms', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                required
              />
              <label
                htmlFor="agree-terms"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                I agree to the{' '}
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Privacy Policy
                </a>
              </label>
            </View>

            <Button
              label="Create Account"
              onPress={handleSignup}
              className="w-full"
            />
          </form>

          {/* Divider */}
          <View className="my-6">
            <View className="relative">
              <View className="absolute inset-0 flex items-center">
                <View className="w-full border-t border-gray-300 dark:border-gray-700" />
              </View>
              <View className="relative flex justify-center text-sm">
                <Text className="bg-white px-4 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  Or sign up with
                </Text>
              </View>
            </View>
          </View>

          {/* Social Signup */}
          <View className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Google
            </button>
            <button className="flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              GitHub
            </button>
          </View>

          {/* Sign in link */}
          <Text className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <button
              onClick={handleLogin}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Sign in
            </button>
          </Text>
        </View>
      </View>
    </View>
  );
}
