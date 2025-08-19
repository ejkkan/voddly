import { Redirect } from 'expo-router';
import { router } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import type { LoginFormProps } from '@/components/login-form';
import { LoginForm } from '@/components/login-form';
import {
  FocusAwareStatusBar,
  SafeAreaView,
  ScrollView,
  View,
} from '@/components/ui';
import { useSession, useSignIn } from '@/lib/auth/hooks';

export default function Login() {
  const signIn = useSignIn();
  const { data: session } = useSession();

  if (session?.data?.user) {
    return <Redirect href="/(app)" />;
  }

  const onSubmit: LoginFormProps['onSubmit'] = async (data) => {
    try {
      const result = await signIn.mutateAsync({
        email: data.email,
        password: data.password,
      });
      if ((result as any)?.data) {
        router.replace('/(app)');
      }
    } catch (e) {
      console.log('Login failed', e);
    }
  };
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
            <View className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <LoginForm onSubmit={onSubmit} loading={signIn.isPending} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
