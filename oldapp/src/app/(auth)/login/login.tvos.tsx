import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput, View as RNView, TouchableOpacity } from 'react-native';

import { SafeAreaView, Text } from '@/components/ui';
import { useAuth } from '@/lib';

export default function LoginTVOS() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (email.trim() && password.trim()) {
      console.log('tvOS login:', { email, password });
      signIn({ access: 'access-token', refresh: 'refresh-token' });
      router.push('/');
    }
  };

  const handleSignup = () => {
    router.push('/signup');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      <RNView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        {/* Logo */}
        <RNView style={{ marginBottom: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
            IPTV Test
          </Text>
          <Text style={{ marginTop: 16, fontSize: 20, color: '#9CA3AF' }}>
            TV Experience
          </Text>
        </RNView>

        {/* Simple Form */}
        <RNView style={{ width: '100%', maxWidth: 400, gap: 20 }}>
          {/* Email Field */}
          <RNView
            style={{ backgroundColor: '#1F2937', padding: 20, borderRadius: 8 }}
          >
            <Text style={{ marginBottom: 8, fontSize: 16, color: '#9CA3AF' }}>
              Email
            </Text>
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ fontSize: 18, color: 'white' }}
            />
          </RNView>

          {/* Password Field */}
          <RNView
            style={{ backgroundColor: '#1F2937', padding: 20, borderRadius: 8 }}
          >
            <Text style={{ marginBottom: 8, fontSize: 16, color: '#9CA3AF' }}>
              Password
            </Text>
            <TextInput
              placeholder="Enter your password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ fontSize: 18, color: 'white' }}
            />
          </RNView>

          {/* Sign In Button */}
          <TouchableOpacity
            onPress={handleLogin}
            style={{
              backgroundColor: '#1D4ED8',
              padding: 20,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: 'white' }}>
              Sign In
            </Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <RNView style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#9CA3AF' }}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={handleSignup} style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 16, color: '#60A5FA' }}>Sign Up</Text>
            </TouchableOpacity>
          </RNView>
        </RNView>
      </RNView>
    </SafeAreaView>
  );
}
