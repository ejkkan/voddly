import React from 'react';
import { View, Text, Pressable } from '@/components/ui';
import { AnimatedIcon } from '@/components/ui';

/**
 * Simple test component to verify animated icons are working
 */
export function AnimatedIconTest() {
  return (
    <View className="p-8 bg-gray-900">
      <Text className="text-white text-xl mb-6">Animated Icons Test</Text>

      <View className="flex-row flex-wrap gap-4">
        {/* Test basic animation */}
        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Basic</Text>
          <AnimatedIcon name="heart" size={32} strokeColor="#fff" />
        </View>

        {/* Test hover animation */}
        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Hover</Text>
          <AnimatedIcon
            name="heart"
            size={32}
            strokeColor="#fff"
            animateOnHover={true}
          />
        </View>

        {/* Test active state */}
        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Active</Text>
          <AnimatedIcon
            name="heart"
            size={32}
            strokeColor="#ff0000"
            active={true}
          />
        </View>

        {/* Test autoplay */}
        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Autoplay</Text>
          <AnimatedIcon
            name="loading2"
            size={32}
            strokeColor="#3b82f6"
            autoplay={true}
            loop={true}
          />
        </View>

        {/* Test different icons */}
        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Home</Text>
          <AnimatedIcon
            name="home"
            size={32}
            strokeColor="#fff"
            animateOnHover={true}
          />
        </View>

        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Settings</Text>
          <AnimatedIcon
            name="settings"
            size={32}
            strokeColor="#fff"
            animateOnHover={true}
          />
        </View>

        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Search</Text>
          <AnimatedIcon
            name="searchToX"
            size={32}
            strokeColor="#fff"
            animateOnHover={true}
          />
        </View>

        <View className="items-center p-4 bg-gray-800 rounded">
          <Text className="text-white text-sm mb-2">Video</Text>
          <AnimatedIcon
            name="video"
            size={32}
            strokeColor="#fff"
            animateOnHover={true}
          />
        </View>
      </View>

      <Text className="text-gray-400 text-sm mt-6">
        Hover over the icons to see animations (web only). Touch icons on mobile
        to trigger animations.
      </Text>
    </View>
  );
}
