import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import {
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
  Pressable,
} from '@/components/ui';
import { useIsFirstTime } from '@/lib/hooks';
import { useTVOSFocus } from '@/lib/tvos-focus';

const features = [
  {
    id: '1',
    title: 'TV-Optimized Interface',
    description: 'Navigate easily with your Apple TV remote',
    icon: '🎮',
  },
  {
    id: '2',
    title: 'Big Screen Experience',
    description: 'Enjoy content on your television in stunning quality',
    icon: '📺',
  },
  {
    id: '3',
    title: 'Voice Control',
    description: 'Use Siri to find your favorite content',
    icon: '🎤',
  },
  {
    id: '4',
    title: 'Family Sharing',
    description: 'Share your subscription with your household',
    icon: '👨‍👩‍👧‍👦',
  },
];

export default function OnboardingTVOS() {
  const [_, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [currentFeature, setCurrentFeature] = useState(0);
  const [focusedButton, setFocusedButton] = useState<'start' | 'skip'>('start');

  const handleGetStarted = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const handleSkip = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const startFocus = useTVOSFocus(() => {
    setFocusedButton('start');
  });

  const skipFocus = useTVOSFocus(() => {
    setFocusedButton('skip');
  });

  // Auto-rotate features
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <FocusAwareStatusBar />

      <View className="flex-1 items-center justify-center px-20">
        {/* Large Logo */}
        <View className="mb-12 items-center">
          <Text className="text-7xl font-bold text-white">IPTV Test</Text>
          <Text className="mt-4 text-3xl text-blue-400">TV Experience</Text>
        </View>

        {/* Feature Display */}
        <View className="mb-16 h-40 items-center justify-center">
          <Text className="mb-4 text-6xl">{features[currentFeature].icon}</Text>
          <Text className="mb-2 text-3xl font-semibold text-white">
            {features[currentFeature].title}
          </Text>
          <Text className="text-center text-xl text-gray-400">
            {features[currentFeature].description}
          </Text>
        </View>

        {/* Feature Indicators */}
        <View className="mb-12 flex-row space-x-3">
          {features.map((_, index) => (
            <View
              key={index}
              className={`h-3 w-3 rounded-full ${
                index === currentFeature ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <View className="flex-row space-x-8">
          <Pressable
            {...startFocus.focusProps}
            onPress={handleGetStarted}
            className={`rounded-xl px-12 py-6 ${
              focusedButton === 'start' ? 'bg-blue-600' : 'bg-blue-700'
            }`}
          >
            <Text className="text-2xl font-semibold text-white">
              Get Started
            </Text>
          </Pressable>

          <Pressable
            {...skipFocus.focusProps}
            onPress={handleSkip}
            className={`rounded-xl px-12 py-6 ${
              focusedButton === 'skip' ? 'bg-gray-700' : 'bg-gray-800'
            }`}
          >
            <Text className="text-2xl text-gray-300">Skip Tour</Text>
          </Pressable>
        </View>

        {/* Remote Hints */}
        <View className="absolute bottom-10 flex-row space-x-8">
          <View className="flex-row items-center">
            <View className="h-8 w-8 rounded bg-gray-700" />
            <Text className="ml-3 text-lg text-gray-500">Navigate</Text>
          </View>
          <View className="flex-row items-center">
            <View className="h-8 w-8 rounded-full bg-gray-700" />
            <Text className="ml-3 text-lg text-gray-500">Select</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
