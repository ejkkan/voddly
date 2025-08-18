// Fallback onboarding for platforms without specific implementation
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, ScrollView, TouchableOpacity } from 'react-native';

import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
} from '@/components/ui';
import { useIsFirstTime } from '@/lib/hooks';

const { width: screenWidth } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Welcome to IPTV Test',
    subtitle: 'Multi-Platform',
    description: 'Enjoy IPTV across devices',
    icon: '✨',
  },
  {
    id: '2',
    title: 'Live TV',
    subtitle: 'Thousands of Channels',
    description: 'Sports, news, and more',
    icon: '📡',
  },
  {
    id: '3',
    title: 'On-Demand',
    subtitle: 'Movies & Series',
    description: 'Binge your favorites',
    icon: '🎬',
  },
];

export default function OnboardingFallback() {
  const [, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const complete = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const next = currentSlide + 1;
      scrollViewRef.current?.scrollTo({
        x: next * screenWidth,
        animated: true,
      });
      setCurrentSlide(next);
    } else {
      complete();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <FocusAwareStatusBar />
      <View className="absolute right-4 top-12 z-10">
        <TouchableOpacity onPress={complete}>
          <Text className="text-gray-600 dark:text-gray-400">Skip</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e: any) => {
          const w = e.nativeEvent.layoutMeasurement.width;
          setCurrentSlide(Math.round(e.nativeEvent.contentOffset.x / w));
        }}
        className="flex-1"
      >
        {slides.map((s) => (
          <View
            key={s.id}
            style={{ width: screenWidth }}
            className="flex-1 items-center justify-center px-8"
          >
            <Text className="mb-8 text-8xl">{s.icon}</Text>
            <Text className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
              {s.title}
            </Text>
            <Text className="mb-4 text-xl font-medium text-blue-600 dark:text-blue-400">
              {s.subtitle}
            </Text>
            <Text className="text-center text-lg text-gray-600 dark:text-gray-400">
              {s.description}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View className="px-8 pb-8">
        <View className="mb-8 flex-row justify-center space-x-2">
          {slides.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${i === currentSlide ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
            />
          ))}
        </View>
        <Button
          label={currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}
