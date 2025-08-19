import React from 'react';
import { Redirect } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LoginForm, type FormType } from '@/components/login-form';
import { SafeAreaView, ScrollView, View } from '@/components/ui';
import { useSession, useSignIn } from '@/lib/auth/hooks';

export default function SignIn() {
  const { data: session } = useSession();
  const signIn = useSignIn();

  if (session?.data?.user) {
    return <Redirect href="/(app)" />;
  }

  const handleSubmit = async (_data: FormType) => {
    await signIn.mutateAsync({ email: _data.email, password: _data.password });
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
              <LoginForm onSubmit={handleSubmit} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
