import { Link, Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { type FormType, SignupForm } from '@/components/signup-form';
import { Button, SafeAreaView, ScrollView, Text, View } from '@/components/ui';
import { useSession, useSignUp } from '@/lib/auth/hooks';

export default function SignUp() {
  const { data: session } = useSession();
  const signUp = useSignUp();
  const [justSignedUp, setJustSignedUp] = useState(false);

  // Only redirect if user is logged in and didn't just sign up
  if (session?.data?.user && !justSignedUp) {
    return <Redirect href="/" />;
  }

  const handleSubmit = async (_data: FormType) => {
    const result = await signUp.mutateAsync({
      email: _data.email,
      password: _data.password,
      name: _data.name,
    });
    if ((result as any)?.data) {
      // Mark that we just signed up to prevent auto-redirect
      setJustSignedUp(true);
      // Go through root index which will redirect to passphrase-setup
      router.replace('/');
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
              <SignupForm onSubmit={handleSubmit} />
              <View className="mt-4 items-center">
                <Text className="mb-2 text-neutral-700 dark:text-neutral-300">
                  Already have an account?
                </Text>
                <Link href="/signin" asChild>
                  <Button variant="ghost" label="Go to Sign in" />
                </Link>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
