import React, { useState } from 'react';
import { ScrollView } from 'react-native';

import { AnimatedIcon } from '@/components/ui';
import { Pressable, Text, View } from '@/components/ui';
import {
  ANIMATED_ICONS,
  ICON_CATEGORIES,
  AnimatedIconName,
} from '@/lib/animated-icons';

/**
 * AnimatedIconsDemo - A comprehensive showcase of all available animated icons
 *
 * This component displays all available react-useanimations icons organized by category,
 * allowing users to see animations on hover and test different configurations.
 */
export function AnimatedIconsDemo() {
  const [selectedIcon, setSelectedIcon] = useState<AnimatedIconName | null>(
    null
  );
  const [animateOnHover, setAnimateOnHover] = useState(true);
  const [iconSize, setIconSize] = useState(32);

  const allIcons = Object.keys(ANIMATED_ICONS) as AnimatedIconName[];

  return (
    <ScrollView className="flex-1 bg-gray-900 p-6">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-white mb-2">
          Animated Icons Demo
        </Text>
        <Text className="text-gray-400 mb-6">
          Explore all {allIcons.length} available react-useanimations icons with
          hover animations
        </Text>

        {/* Controls */}
        <View className="flex-row gap-4 mb-6 p-4 bg-gray-800 rounded-lg">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setAnimateOnHover(!animateOnHover)}
              className={`px-3 py-1 rounded ${animateOnHover ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <Text className="text-white text-sm">
                Hover Animation: {animateOnHover ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center gap-2">
            <Text className="text-white text-sm">Size:</Text>
            {[24, 32, 48].map((size) => (
              <Pressable
                key={size}
                onPress={() => setIconSize(size)}
                className={`px-2 py-1 rounded ${iconSize === size ? 'bg-blue-600' : 'bg-gray-600'}`}
              >
                <Text className="text-white text-xs">{size}px</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Icons by Category */}
      {Object.entries(ICON_CATEGORIES).map(([categoryName, iconNames]) => (
        <View key={categoryName} className="mb-8">
          <Text className="text-xl font-semibold text-white mb-4 capitalize">
            {categoryName} Icons ({iconNames.length})
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {iconNames.map((iconName) => (
              <IconCard
                key={iconName}
                iconName={iconName}
                size={iconSize}
                animateOnHover={animateOnHover}
                isSelected={selectedIcon === iconName}
                onPress={() =>
                  setSelectedIcon(iconName === selectedIcon ? null : iconName)
                }
              />
            ))}
          </View>
        </View>
      ))}

      {/* Uncategorized Icons */}
      {(() => {
        const categorizedIcons = new Set(Object.values(ICON_CATEGORIES).flat());
        const uncategorizedIcons = allIcons.filter(
          (icon) => !categorizedIcons.has(icon)
        );

        if (uncategorizedIcons.length === 0) return null;

        return (
          <View className="mb-8">
            <Text className="text-xl font-semibold text-white mb-4">
              Other Icons ({uncategorizedIcons.length})
            </Text>
            <View className="flex-row flex-wrap gap-4">
              {uncategorizedIcons.map((iconName) => (
                <IconCard
                  key={iconName}
                  iconName={iconName}
                  size={iconSize}
                  animateOnHover={animateOnHover}
                  isSelected={selectedIcon === iconName}
                  onPress={() =>
                    setSelectedIcon(iconName === selectedIcon ? null : iconName)
                  }
                />
              ))}
            </View>
          </View>
        );
      })()}

      {/* Selected Icon Details */}
      {selectedIcon && (
        <View className="mt-8 p-6 bg-gray-800 rounded-lg">
          <Text className="text-xl font-semibold text-white mb-4">
            Selected: {selectedIcon}
          </Text>
          <View className="flex-row items-center gap-6">
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">Normal</Text>
              <AnimatedIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                animateOnHover={false}
              />
            </View>
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">
                Hover Animation
              </Text>
              <AnimatedIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                animateOnHover={true}
              />
            </View>
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">Active State</Text>
              <AnimatedIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                active={true}
              />
            </View>
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">Auto Loop</Text>
              <AnimatedIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                autoplay={true}
                loop={true}
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-gray-400 text-sm">Usage:</Text>
            <View className="mt-2 p-3 bg-gray-900 rounded">
              <Text className="text-green-400 text-xs font-mono">
                {`<AnimatedIcon name="${selectedIcon}" size={24} animateOnHover />`}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

interface IconCardProps {
  iconName: AnimatedIconName;
  size: number;
  animateOnHover: boolean;
  isSelected: boolean;
  onPress: () => void;
}

function IconCard({
  iconName,
  size,
  animateOnHover,
  isSelected,
  onPress,
}: IconCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        items-center justify-center p-4 rounded-lg border-2 min-w-[100px]
        ${
          isSelected
            ? 'bg-blue-600/20 border-blue-500'
            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
        }
      `}
    >
      <View className="mb-2">
        <AnimatedIcon
          name={iconName}
          size={size}
          strokeColor={isSelected ? '#3b82f6' : '#ffffff'}
          animateOnHover={animateOnHover}
        />
      </View>
      <Text
        className={`text-xs text-center ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}
      >
        {iconName}
      </Text>
    </Pressable>
  );
}
