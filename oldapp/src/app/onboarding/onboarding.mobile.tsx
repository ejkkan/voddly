import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native';

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
    subtitle: 'Mobile Experience',
    description: 'Stream your favorite content on the go',
    icon: '📱',
  },
  {
    id: '2',
    title: 'Thousands of Channels',
    subtitle: 'Live TV at Your Fingertips',
    description: 'Access live channels from around the world',
    icon: '📺',
  },
  {
    id: '3',
    title: 'Movies & Series',
    subtitle: 'On-Demand Entertainment',
    description: 'Watch the latest movies and binge your favorite shows',
    icon: '🎬',
  },
  {
    id: '4',
    title: 'Multi-Device Support',
    subtitle: 'Watch Anywhere',
    description: 'Seamlessly switch between your devices',
    icon: '🔄',
  },
];

export default function OnboardingMobile() {
  const [_, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const handleGetStarted = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const handleSkip = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextSlide = currentSlide + 1;
      scrollViewRef.current?.scrollTo({
        x: nextSlide * screenWidth,
        animated: true,
      });
      setCurrentSlide(nextSlide);
    } else {
      handleGetStarted();
    }
  };

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    setCurrentSlide(roundIndex);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <FocusAwareStatusBar />

      {/* Skip Button */}
      <View className="absolute right-4 top-12 z-10">
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-gray-600 dark:text-gray-400">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {slides.map((slide) => (
          <View
            key={slide.id}
            style={{ width: screenWidth }}
            className="flex-1 items-center justify-center px-8"
          >
            <Text className="mb-8 text-8xl">{slide.icon}</Text>
            <Text className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
              {slide.title}
            </Text>
            <Text className="mb-4 text-xl font-medium text-blue-600 dark:text-blue-400">
              {slide.subtitle}
            </Text>
            <Text className="text-center text-lg text-gray-600 dark:text-gray-400">
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Controls */}
      <View className="px-8 pb-8">
        {/* Page Indicators */}
        <View className="mb-8 flex-row justify-center space-x-2">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full ${
                index === currentSlide
                  ? 'w-8 bg-blue-600'
                  : 'w-2 bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button
          label={currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}
