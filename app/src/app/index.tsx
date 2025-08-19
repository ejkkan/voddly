import React from 'react';
import { Link } from 'expo-router';
import { SafeAreaView, Text, View, Button } from '@/components/ui';

export default function PublicHome() {
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
