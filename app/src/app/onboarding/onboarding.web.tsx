import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Button, Text, View } from '@/components/ui';
import { useIsFirstTime } from '@/lib/hooks';

const steps = [
  {
    id: '1',
    title: 'Welcome to IPTV Test',
    subtitle: 'Desktop Experience',
    description: 'Professional streaming platform for your browser',
    features: [
      'Full HD & 4K streaming',
      'Multi-window support',
      'Keyboard shortcuts',
      'Advanced search',
    ],
    icon: '🖥️',
  },
  {
    id: '2',
    title: 'Live Television',
    subtitle: 'Thousands of Channels',
    description: 'Access global content from your desktop',
    features: [
      'International channels',
      'Sports & News',
      'Entertainment',
      'Kids content',
    ],
    icon: '📡',
  },
  {
    id: '3',
    title: 'On-Demand Library',
    subtitle: 'Movies & Series',
    description: 'Your entertainment hub',
    features: [
      'Latest releases',
      'Classic films',
      'TV series',
      'Documentaries',
    ],
    icon: '🎬',
  },
];

export default function OnboardingWeb() {
  const [_, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const handleGetStarted = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const handleSkip = () => {
    setIsFirstTime(false);
    router.replace('/login');
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleGetStarted();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <View className="flex min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Skip Button */}
      <View className="absolute right-8 top-8 z-10">
        <button
          onClick={handleSkip}
          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Skip Intro
        </button>
      </View>

      <View className="flex flex-1 items-center justify-center px-8">
        <View className="w-full max-w-4xl">
          {/* Content Grid */}
          <View className="grid gap-12 md:grid-cols-2">
            {/* Left Column - Illustration */}
            <View className="flex items-center justify-center">
              <View className="text-center">
                <Text className="mb-6 text-9xl">{currentStepData.icon}</Text>
                <View className="space-y-3">
                  {currentStepData.features.map((feature, index) => (
                    <View
                      key={index}
                      className="flex items-center justify-center"
                    >
                      <Text className="text-lg text-gray-600 dark:text-gray-400">
                        ✓ {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Right Column - Content */}
            <View className="flex flex-col justify-center">
              <Text className="mb-3 text-5xl font-bold text-gray-900 dark:text-white">
                {currentStepData.title}
              </Text>
              <Text className="mb-4 text-2xl font-medium text-blue-600 dark:text-blue-400">
                {currentStepData.subtitle}
              </Text>
              <Text className="mb-8 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
                {currentStepData.description}
              </Text>

              {/* Progress Indicators */}
              <View className="mb-8 flex space-x-2">
                {steps.map((_, index) => (
                  <View
                    key={index}
                    className={`h-2 transition-all ${
                      index === currentStep
                        ? 'w-12 bg-blue-600'
                        : index < currentStep
                          ? 'w-6 bg-blue-400'
                          : 'w-6 bg-gray-300 dark:bg-gray-700'
                    } rounded-full`}
                  />
                ))}
              </View>

              {/* Navigation Buttons */}
              <View className="flex space-x-4">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Previous
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex-1 rounded-lg bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700"
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                </button>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Info */}
      <View className="absolute bottom-8 left-0 right-0 text-center">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          Step {currentStep + 1} of {steps.length}
        </Text>
      </View>
    </View>
  );
}
