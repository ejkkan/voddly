import { Redirect, router } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { type FormType, LoginForm } from '@/components/login-form';
import { SafeAreaView, ScrollView, View } from '@/components/ui';
import { useSession, useSignIn } from '@/lib/auth/hooks';

export default function SignIn() {
  const { data: session } = useSession();
  const signIn = useSignIn();

  // Let the root index handle logged-in user redirects
  // This prevents conflicts
  if (session?.data?.user) {
    return <Redirect href="/" />;
  }

  const handleSubmit = async (_data: FormType) => {
    console.log('handleSubmit', _data);
    try {
      const result = await signIn.mutateAsync({
        email: _data.email,
        password: _data.password,
      });
      console.log('result', result);
      if ((result as any)?.data) {
        // Go through root index to check encryption status
        router.replace('/');
      }
    } catch (error) {
      console.log('error', error);
    }
  };

  return (
    <SafeAreaView className="flex-1">
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
              <LoginForm onSubmit={handleSubmit} loading={signIn.isPending} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
