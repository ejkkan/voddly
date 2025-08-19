import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useWindowDimensions } from 'react-native';

import { Image, Pressable, Text, View } from '@/components/ui';

type HeroProps = {
  title: string;
  subtitle?: string;
  imageUrl: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
};

function Hero({
  title,
  subtitle,
  imageUrl,
  primaryAction,
  secondaryAction,
}: HeroProps) {
  const { height, width } = useWindowDimensions();
  const isLarge = width >= 900;
  const heroHeight = isLarge
    ? Math.max(420, height * 0.6)
    : Math.max(320, height * 0.42);

  return (
    <View className="mb-6 w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-black">
      <View style={{ height: heroHeight }} className="w-full">
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          className="size-full"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
          locations={[0.4, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
        />
        <View className="absolute inset-x-0 bottom-0 p-4 md:p-6 lg:p-8">
          <Text className="text-2xl font-extrabold text-white md:text-4xl lg:text-5xl">
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-2 max-w-[800px] text-base text-neutral-200 md:text-lg">
              {subtitle}
            </Text>
          ) : null}
          <View className="mt-4 flex-row gap-3">
            {primaryAction ? (
              <Pressable
                onPress={primaryAction.onPress}
                className="rounded-md bg-white px-5 py-3"
              >
                <Text className="text-base font-semibold text-black">
                  {primaryAction.label}
                </Text>
              </Pressable>
            ) : null}
            {secondaryAction ? (
              <Pressable
                onPress={secondaryAction.onPress}
                className="rounded-md border border-white/40 px-5 py-3"
              >
                <Text className="text-base font-semibold text-white">
                  {secondaryAction.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export default Hero;
