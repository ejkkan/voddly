import { useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import { TextInput } from 'react-native';

import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
  Pressable,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { useTVOSFocus, getTVOSFocusStyles } from '@/lib/tvos-focus';

export default function LoginTVOS() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<
    'email' | 'password' | 'button' | 'signup'
  >('email');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = () => {
    console.log('tvOS login:', { email, password });
    signIn({ access: 'access-token', refresh: 'refresh-token' });
    router.push('/');
  };

  const handleSignup = () => {
    router.push('/signup');
  };

  // TV Remote Navigation
  const handleEmailFocus = useTVOSFocus(() => {
    setFocusedField('email');
    emailRef.current?.focus();
  });

  const handlePasswordFocus = useTVOSFocus(() => {
    setFocusedField('password');
    passwordRef.current?.focus();
  });

  const handleButtonFocus = useTVOSFocus(() => {
    setFocusedField('button');
  });

  const handleSignupFocus = useTVOSFocus(() => {
    setFocusedField('signup');
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <FocusAwareStatusBar />

      <View className="flex-1 items-center justify-center px-20">
        {/* Large TV-friendly Logo */}
        <View className="mb-12 items-center">
          <Text className="text-6xl font-bold text-white">IPTV Test</Text>
          <Text className="mt-4 text-2xl text-gray-400">TV Experience</Text>
        </View>

        {/* Login Form - Large touch targets for remote */}
        <View className="w-full max-w-2xl space-y-6">
          {/* Email Field */}
          <Pressable
            {...handleEmailFocus.focusProps}
            className={`rounded-xl border-2 p-6 ${
              focusedField === 'email'
                ? 'border-blue-500 bg-gray-800'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <Text className="mb-2 text-lg text-gray-400">Email</Text>
            <TextInput
              ref={emailRef}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              className="text-2xl text-white"
              editable={focusedField === 'email'}
            />
          </Pressable>

          {/* Password Field */}
          <Pressable
            {...handlePasswordFocus.focusProps}
            className={`rounded-xl border-2 p-6 ${
              focusedField === 'password'
                ? 'border-blue-500 bg-gray-800'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <Text className="mb-2 text-lg text-gray-400">Password</Text>
            <TextInput
              ref={passwordRef}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              className="text-2xl text-white"
              editable={focusedField === 'password'}
            />
          </Pressable>

          {/* Sign In Button - Extra large for TV */}
          <Pressable
            {...handleButtonFocus.focusProps}
            onPress={handleLogin}
            className={`mt-8 rounded-xl p-6 ${
              focusedField === 'button' ? 'bg-blue-600' : 'bg-blue-700'
            }`}
          >
            <Text className="text-center text-2xl font-semibold text-white">
              Sign In
            </Text>
          </Pressable>

          {/* Sign Up Link */}
          <View className="mt-8 items-center">
            <Text className="text-xl text-gray-400">
              Don't have an account?
            </Text>
            <Pressable
              {...handleSignupFocus.focusProps}
              onPress={handleSignup}
              className={`mt-2 rounded-lg px-6 py-3 ${
                focusedField === 'signup' ? 'bg-gray-700' : 'bg-transparent'
              }`}
            >
              <Text className="text-xl font-medium text-blue-400">Sign Up</Text>
            </Pressable>
          </View>
        </View>

        {/* Remote Control Hints */}
        <View className="absolute bottom-10 flex-row space-x-8">
          <View className="flex-row items-center">
            <View className="h-8 w-8 rounded bg-gray-700" />
            <Text className="ml-2 text-gray-500">Navigate</Text>
          </View>
          <View className="flex-row items-center">
            <View className="h-8 w-8 rounded-full bg-gray-700" />
            <Text className="ml-2 text-gray-500">Select</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
