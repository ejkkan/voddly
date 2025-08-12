import { useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import { TextInput, ScrollView } from 'react-native';

import {
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
  Pressable,
} from '@/components/ui';
import { useAuth } from '@/lib';
import { useTVOSFocus } from '@/lib/tvos-focus';

type FocusField =
  | 'name'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'button'
  | 'signin';

export default function SignupTVOS() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [focusedField, setFocusedField] = useState<FocusField>('name');

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSignup = () => {
    console.log('tvOS signup:', formData);
    signIn({ access: 'access-token', refresh: 'refresh-token' });
    router.push('/');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // TV Remote Focus Handlers
  const createFocusHandler = (
    field: FocusField,
    ref?: React.RefObject<TextInput>
  ) => {
    return useTVOSFocus(() => {
      setFocusedField(field);
      ref?.current?.focus();
    });
  };

  const nameFocus = createFocusHandler('name', nameRef);
  const emailFocus = createFocusHandler('email', emailRef);
  const passwordFocus = createFocusHandler('password', passwordRef);
  const confirmPasswordFocus = createFocusHandler(
    'confirmPassword',
    confirmPasswordRef
  );
  const buttonFocus = createFocusHandler('button');
  const signinFocus = createFocusHandler('signin');

  const getFieldStyles = (field: FocusField) => {
    return `rounded-xl border-2 p-5 ${
      focusedField === field
        ? 'border-blue-500 bg-gray-800'
        : 'border-gray-700 bg-gray-800/50'
    }`;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <FocusAwareStatusBar />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center px-20 py-12">
          {/* Large TV-friendly Header */}
          <View className="mb-10 items-center">
            <Text className="text-5xl font-bold text-white">
              Create Account
            </Text>
            <Text className="mt-3 text-xl text-gray-400">
              Join IPTV Test on TV
            </Text>
          </View>

          {/* Signup Form - Large touch targets for remote */}
          <View className="w-full max-w-2xl space-y-5">
            {/* Name Field */}
            <Pressable
              {...nameFocus.focusProps}
              className={getFieldStyles('name')}
            >
              <Text className="mb-2 text-lg text-gray-400">Full Name</Text>
              <TextInput
                ref={nameRef}
                placeholder="Enter your name"
                placeholderTextColor="#666"
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                autoCapitalize="words"
                className="text-xl text-white"
                editable={focusedField === 'name'}
              />
            </Pressable>

            {/* Email Field */}
            <Pressable
              {...emailFocus.focusProps}
              className={getFieldStyles('email')}
            >
              <Text className="mb-2 text-lg text-gray-400">Email</Text>
              <TextInput
                ref={emailRef}
                placeholder="Enter your email"
                placeholderTextColor="#666"
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                autoCapitalize="none"
                keyboardType="email-address"
                className="text-xl text-white"
                editable={focusedField === 'email'}
              />
            </Pressable>

            {/* Password Field */}
            <Pressable
              {...passwordFocus.focusProps}
              className={getFieldStyles('password')}
            >
              <Text className="mb-2 text-lg text-gray-400">Password</Text>
              <TextInput
                ref={passwordRef}
                placeholder="Create password"
                placeholderTextColor="#666"
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry
                className="text-xl text-white"
                editable={focusedField === 'password'}
              />
            </Pressable>

            {/* Confirm Password Field */}
            <Pressable
              {...confirmPasswordFocus.focusProps}
              className={getFieldStyles('confirmPassword')}
            >
              <Text className="mb-2 text-lg text-gray-400">
                Confirm Password
              </Text>
              <TextInput
                ref={confirmPasswordRef}
                placeholder="Confirm password"
                placeholderTextColor="#666"
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                secureTextEntry
                className="text-xl text-white"
                editable={focusedField === 'confirmPassword'}
              />
            </Pressable>

            {/* Create Account Button - Extra large for TV */}
            <Pressable
              {...buttonFocus.focusProps}
              onPress={handleSignup}
              className={`mt-6 rounded-xl p-5 ${
                focusedField === 'button' ? 'bg-blue-600' : 'bg-blue-700'
              }`}
            >
              <Text className="text-center text-2xl font-semibold text-white">
                Create Account
              </Text>
            </Pressable>

            {/* Sign In Link */}
            <View className="mt-6 items-center">
              <Text className="text-lg text-gray-400">
                Already have an account?
              </Text>
              <Pressable
                {...signinFocus.focusProps}
                onPress={handleLogin}
                className={`mt-2 rounded-lg px-6 py-3 ${
                  focusedField === 'signin' ? 'bg-gray-700' : 'bg-transparent'
                }`}
              >
                <Text className="text-xl font-medium text-blue-400">
                  Sign In
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Remote Control Hints */}
          <View className="mt-8 flex-row space-x-8">
            <View className="flex-row items-center">
              <View className="h-6 w-6 rounded bg-gray-700" />
              <Text className="ml-2 text-gray-500">Navigate</Text>
            </View>
            <View className="flex-row items-center">
              <View className="h-6 w-6 rounded-full bg-gray-700" />
              <Text className="ml-2 text-gray-500">Select</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
