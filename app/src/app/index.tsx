import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { SafeAreaView, Text, View, Button } from '@/components/ui';
import { useSession } from '@/lib/auth/hooks';
import { apiClient } from '@/lib/api-client';
import { Link } from 'expo-router';

export default function PublicHome() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const [hasEncryption, setHasEncryption] = useState<boolean | null>(null);
  const [checkingEncryption, setCheckingEncryption] = useState(false);

  useEffect(() => {
    // Check encryption status if logged in
    if (!sessionLoading && session?.data?.user) {
      setCheckingEncryption(true);
      apiClient.user
        .getAccount()
        .then(({ account, hasEncryption }) => {
          setHasEncryption(!!account && !!hasEncryption);
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
      return <Redirect href="/passphrase-setup" />;
    }
    return <Redirect href="/(app)/dashboard" />;
  }

  // Show public landing page for non-authenticated users
  return (
    <SafeAreaView>
      <View className="flex-1 items-center justify-center p-6 gap-6 bg-white dark:bg-black">
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
