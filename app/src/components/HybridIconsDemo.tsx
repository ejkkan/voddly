import React, { useState } from 'react';
import { ScrollView } from 'react-native';

import { HybridIcon, HybridIconName } from '@/components/ui';
import { Pressable, Text, View } from '@/components/ui';

/**
 * HybridIconsDemo - A showcase of both react-useanimations and Lordicon icons
 * 
 * This component demonstrates the unified HybridIcon system that can render
 * both react-useanimations and Lordicon icons with the same API.
 */
export function HybridIconsDemo() {
  const [selectedIcon, setSelectedIcon] = useState<HybridIconName | null>(null);
  const [animateOnHover, setAnimateOnHover] = useState(true);
  const [iconSize, setIconSize] = useState(32);

  // Sample icons from both systems
  const sampleIcons: { name: HybridIconName; type: 'react-useanimations' | 'lordicon' }[] = [
    { name: 'home', type: 'react-useanimations' },
    { name: 'heart', type: 'react-useanimations' },
    { name: 'bookmark', type: 'react-useanimations' },
    { name: 'folder', type: 'react-useanimations' },
    { name: 'notification', type: 'lordicon' }, // This is the Lordicon
    { name: 'userPlus', type: 'react-useanimations' },
    { name: 'settings', type: 'react-useanimations' },
    { name: 'video', type: 'react-useanimations' },
    { name: 'searchToX', type: 'react-useanimations' },
    { name: 'loading2', type: 'react-useanimations' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-900 p-6">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-white mb-2">
          Hybrid Icons Demo
        </Text>
        <Text className="text-gray-400 mb-6">
          Unified system using both react-useanimations and Lordicon icons
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

      {/* Icons Grid */}
      <View className="mb-8">
        <Text className="text-xl font-semibold text-white mb-4">
          Available Icons ({sampleIcons.length})
        </Text>
        <View className="flex-row flex-wrap gap-4">
          {sampleIcons.map((iconData) => (
            <IconCard
              key={iconData.name}
              iconName={iconData.name}
              iconType={iconData.type}
              size={iconSize}
              animateOnHover={animateOnHover}
              isSelected={selectedIcon === iconData.name}
              onPress={() => setSelectedIcon(iconData.name === selectedIcon ? null : iconData.name)}
            />
          ))}
        </View>
      </View>

      {/* Selected Icon Details */}
      {selectedIcon && (
        <View className="mt-8 p-6 bg-gray-800 rounded-lg">
          <Text className="text-xl font-semibold text-white mb-4">
            Selected: {selectedIcon}
          </Text>
          <Text className="text-sm text-gray-400 mb-4">
            Type: {sampleIcons.find(i => i.name === selectedIcon)?.type}
          </Text>
          
          <View className="flex-row items-center gap-6">
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">Normal</Text>
              <HybridIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                animateOnHover={false}
              />
            </View>
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">Hover Animation</Text>
              <HybridIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                animateOnHover={true}
              />
            </View>
            <View className="items-center">
              <Text className="text-gray-400 text-sm mb-2">Active State</Text>
              <HybridIcon
                name={selectedIcon}
                size={48}
                strokeColor="#ffffff"
                active={true}
              />
            </View>
            {selectedIcon === 'loading2' && (
              <View className="items-center">
                <Text className="text-gray-400 text-sm mb-2">Auto Loop</Text>
                <HybridIcon
                  name={selectedIcon}
                  size={48}
                  strokeColor="#ffffff"
                  autoplay={true}
                  loop={true}
                />
              </View>
            )}
          </View>
          
          <View className="mt-4">
            <Text className="text-gray-400 text-sm">Usage:</Text>
            <View className="mt-2 p-3 bg-gray-900 rounded">
              <Text className="text-green-400 text-xs font-mono">
                {`<HybridIcon name="${selectedIcon}" size={24} animateOnHover />`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Integration Info */}
      <View className="mt-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <Text className="text-blue-400 font-semibold mb-2">🎉 Integration Complete!</Text>
        <Text className="text-gray-300 text-sm">
          The notification icon is now powered by Lordicon, while other icons use react-useanimations. 
          The HybridIcon component automatically detects and renders the appropriate icon type.
        </Text>
      </View>
    </ScrollView>
  );
}

interface IconCardProps {
  iconName: HybridIconName;
  iconType: 'react-useanimations' | 'lordicon';
  size: number;
  animateOnHover: boolean;
  isSelected: boolean;
  onPress: () => void;
}

function IconCard({ iconName, iconType, size, animateOnHover, isSelected, onPress }: IconCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        items-center justify-center p-4 rounded-lg border-2 min-w-[120px]
        ${isSelected 
          ? 'bg-blue-600/20 border-blue-500' 
          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
        }
      `}
    >
      <View className="mb-2">
        <HybridIcon
          name={iconName}
          size={size}
          strokeColor={isSelected ? '#3b82f6' : '#ffffff'}
          animateOnHover={animateOnHover}
        />
      </View>
      <Text className={`text-xs text-center font-medium ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}>
        {iconName}
      </Text>
      <Text className={`text-xs text-center mt-1 ${isSelected ? 'text-blue-300' : 'text-gray-500'}`}>
        {iconType === 'lordicon' ? 'Lordicon' : 'UseAnimations'}
      </Text>
    </Pressable>
  );
}
