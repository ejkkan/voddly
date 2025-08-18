import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  TextInput,
  ScrollView,
  View as RNView,
  TouchableOpacity,
} from 'react-native';

import { SafeAreaView, Text } from '@/components/ui';
import { useAuth } from '@/lib';

export default function SignupTVOS() {
  const router = useRouter();
  const signIn = useAuth.use.signIn();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSignup = () => {
    if (
      formData.name.trim() &&
      formData.email.trim() &&
      formData.password.trim() &&
      formData.confirmPassword.trim()
    ) {
      if (formData.password === formData.confirmPassword) {
        console.log('tvOS signup:', formData);
        signIn({ access: 'access-token', refresh: 'refresh-token' });
        router.push('/');
      } else {
        console.log('Passwords do not match');
      }
    } else {
      console.log('Please fill all fields');
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <RNView
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          {/* Header */}
          <RNView style={{ marginBottom: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
              Create Account
            </Text>
            <Text style={{ marginTop: 16, fontSize: 18, color: '#9CA3AF' }}>
              Join IPTV Test on TV
            </Text>
          </RNView>

          {/* Simple Form */}
          <RNView style={{ width: '100%', maxWidth: 400, gap: 16 }}>
            {/* Name Field */}
            <RNView
              style={{
                backgroundColor: '#1F2937',
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Text style={{ marginBottom: 8, fontSize: 16, color: '#9CA3AF' }}>
                Full Name
              </Text>
              <TextInput
                placeholder="Enter your name"
                placeholderTextColor="#666"
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                autoCapitalize="words"
                style={{ fontSize: 16, color: 'white' }}
              />
            </RNView>

            {/* Email Field */}
            <RNView
              style={{
                backgroundColor: '#1F2937',
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Text style={{ marginBottom: 8, fontSize: 16, color: '#9CA3AF' }}>
                Email
              </Text>
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#666"
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{ fontSize: 16, color: 'white' }}
              />
            </RNView>

            {/* Password Field */}
            <RNView
              style={{
                backgroundColor: '#1F2937',
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Text style={{ marginBottom: 8, fontSize: 16, color: '#9CA3AF' }}>
                Password
              </Text>
              <TextInput
                placeholder="Create password"
                placeholderTextColor="#666"
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry
                style={{ fontSize: 16, color: 'white' }}
              />
            </RNView>

            {/* Confirm Password Field */}
            <RNView
              style={{
                backgroundColor: '#1F2937',
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Text style={{ marginBottom: 8, fontSize: 16, color: '#9CA3AF' }}>
                Confirm Password
              </Text>
              <TextInput
                placeholder="Confirm password"
                placeholderTextColor="#666"
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                secureTextEntry
                style={{ fontSize: 16, color: 'white' }}
              />
            </RNView>

            {/* Create Account Button */}
            <TouchableOpacity
              onPress={handleSignup}
              style={{
                backgroundColor: '#1D4ED8',
                padding: 16,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: 'white' }}>
                Create Account
              </Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <RNView style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ fontSize: 16, color: '#9CA3AF' }}>
                Already have an account?
              </Text>
              <TouchableOpacity onPress={handleLogin} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 16, color: '#60A5FA' }}>Sign In</Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </RNView>
      </ScrollView>
    </SafeAreaView>
  );
}
