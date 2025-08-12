import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Button, Text, View, Input } from '@/components/ui';
import { useAuth } from '@/lib';

export default function LoginWeb() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log('Web login:', { email, password, rememberMe });
    signIn({ access: 'access-token', refresh: 'refresh-token' });
    router.push('/');
  };

  const handleSignup = () => {
    router.push('/signup');
  };

  return (
    <View className="flex min-h-screen flex-row">
      {/* Left Panel - Branding */}
      <View className="hidden flex-1 items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 lg:flex">
        <View className="px-12 text-center">
          <Text className="text-5xl font-bold text-white">IPTV Test</Text>
          <Text className="mt-4 text-xl text-white/90">Desktop Experience</Text>
          <Text className="mt-8 text-lg leading-relaxed text-white/80">
            Stream your favorite content with our professional IPTV solution.
            Access thousands of channels and on-demand content.
          </Text>
        </View>
      </View>

      {/* Right Panel - Login Form */}
      <View className="flex flex-1 items-center justify-center bg-white px-8 dark:bg-gray-900">
        <View className="w-full max-w-md">
          {/* Mobile Logo (shown on smaller screens) */}
          <View className="mb-8 text-center lg:hidden">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white">
              IPTV Test
            </Text>
          </View>

          <Text className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back
          </Text>

          <form onSubmit={handleLogin} className="space-y-6">
            <View>
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </Text>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoComplete="email"
                required
                className="h-11 w-full"
              />
            </View>

            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </Text>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Forgot password?
                </button>
              </View>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
                required
                className="h-11 w-full"
              />
            </View>

            <View className="flex-row items-center">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                Remember me for 30 days
              </label>
            </View>

            <Button label="Sign in" onPress={handleLogin} className="w-full" />
          </form>

          {/* Divider */}
          <View className="my-6">
            <View className="relative">
              <View className="absolute inset-0 flex items-center">
                <View className="w-full border-t border-gray-300 dark:border-gray-700" />
              </View>
              <View className="relative flex justify-center text-sm">
                <Text className="bg-white px-4 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  Or continue with
                </Text>
              </View>
            </View>
          </View>

          {/* Social Login */}
          <View className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Google
            </button>
            <button className="flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              GitHub
            </button>
          </View>

          {/* Sign up link */}
          <Text className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={handleSignup}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Sign up for free
            </button>
          </Text>
        </View>
      </View>
    </View>
  );
}
