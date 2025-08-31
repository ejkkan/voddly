import { Link, Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Button, SafeAreaView, Text, View } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import { useSession } from '@/lib/auth/hooks';

export default function PublicHome() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const [hasEncryption, setHasEncryption] = useState<boolean | null>(null);
  const [checkingEncryption, setCheckingEncryption] = useState(false);

  useEffect(() => {
    // Check encryption status if logged in
    if (!sessionLoading && session?.data?.user) {
      setCheckingEncryption(true);
      apiClient.user
        .getSubscription()
        .then(({ subscription, hasEncryption }) => {
          setHasEncryption(!!subscription && !!hasEncryption);
        })
        .catch(() => {
          setHasEncryption(false);
        })
        .finally(() => {
          setCheckingEncryption(false);
        });
    }
  }, [session, sessionLoading]);

  // Show loader while checking status
  if (sessionLoading || checkingEncryption) {
    return (
      <SafeAreaView>
        <View className="flex-1 items-center justify-center bg-white dark:bg-black">
          <Text className="text-neutral-600 dark:text-neutral-400">
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Redirect based on auth/encryption status
  if (session?.data?.user) {
    if (hasEncryption === false) {
      // For legacy users without encryption, redirect to passphrase setup
      // New users will have encryption set up during signup
      return <Redirect href="/passphrase-setup" />;
    }
    return <Redirect href="/(app)/dashboard" />;
  }

  // Show public landing page for non-authenticated users
  return (
    <SafeAreaView>
      <View className="flex-1 items-center justify-center gap-6 bg-white p-6 dark:bg-black">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
          Welcome
        </Text>
        <Text className="text-center text-neutral-600 dark:text-neutral-400">
          This is the public landing page.
        </Text>
        <View className="w-full max-w-md gap-3">
          <Link href="/signin" asChild>
            <Button label="Sign in" />
          </Link>
          <Link href="/signup" asChild>
            <Button label="Create account" variant="outline" />
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
