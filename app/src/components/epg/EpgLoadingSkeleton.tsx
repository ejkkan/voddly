import React from 'react';
import { View, Text } from '@/components/ui';

/**
 * Loading skeleton for EPG that shows a realistic preview of the EPG structure
 * while data is being loaded
 */
export function EpgLoadingSkeleton() {
  // Generate skeleton rows for channels
  const skeletonRows = Array.from({ length: 8 }, (_, index) => (
    <View key={index} className="flex-row">
      {/* Channel column skeleton */}
      <View className="w-48 p-2">
        <View className="flex-row items-center space-x-3">
          {/* Channel logo skeleton */}
          <View className="h-10 w-10 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          {/* Channel name skeleton */}
          <View className="flex-1">
            <View
              className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"
              style={{ width: `${60 + Math.random() * 40}%` }}
            />
          </View>
        </View>
      </View>

      {/* Programs skeleton */}
      <View className="flex-1 flex-row">
        {Array.from({ length: 6 }, (_, programIndex) => {
          const width = 120 + Math.random() * 100; // Random program widths
          return (
            <View
              key={programIndex}
              className="mr-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-3 animate-pulse"
              style={{ width, minWidth: 100 }}
            >
              {/* Program title skeleton */}
              <View
                className="h-3 bg-neutral-300 dark:bg-neutral-600 rounded mb-2"
                style={{ width: `${70 + Math.random() * 30}%` }}
              />
              {/* Program description skeleton */}
              <View
                className="h-2 bg-neutral-300 dark:bg-neutral-600 rounded"
                style={{ width: `${50 + Math.random() * 40}%` }}
              />
            </View>
          );
        })}
      </View>
    </View>
  ));

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Header skeleton */}
      <View className="border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-black/90 backdrop-blur-xl">
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-row items-center space-x-4">
            {/* Category selector skeleton */}
            <View className="h-8 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
            <View className="h-6 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </View>

          {/* Controls skeleton */}
          <View className="flex-row items-center space-x-3">
            <View className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
            <View className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
          </View>
        </View>

        {/* Timeline skeleton */}
        <View className="flex-row border-t border-neutral-200 dark:border-neutral-800">
          <View className="w-48" /> {/* Channel column spacer */}
          <View className="flex-1 flex-row">
            {Array.from({ length: 12 }, (_, index) => (
              <View
                key={index}
                className="flex-1 border-r border-neutral-200 dark:border-neutral-800 p-2"
              >
                <View className="h-4 w-12 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mx-auto" />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* EPG Content skeleton */}
      <View className="flex-1">
        <View className="space-y-1 p-2">{skeletonRows}</View>

        {/* Loading indicator overlay */}
        <View className="absolute inset-0 items-center justify-center bg-white/50 dark:bg-black/50">
          <View className="rounded-xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
            <View className="items-center space-y-4">
              {/* Spinner */}
              <View className="h-8 w-8 rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 animate-spin" />

              {/* Loading text */}
              <View className="items-center space-y-2">
                <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Loading EPG
                </Text>
                <Text className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                  Fetching channel data and program information...
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Simplified loading skeleton for mobile EPG view
 */
export function EpgLoadingSkeletonMobile() {
  const skeletonChannels = Array.from({ length: 6 }, (_, index) => (
    <View
      key={index}
      className="mx-4 my-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-4"
    >
      <View className="flex-row items-center space-x-3">
        {/* Channel logo skeleton */}
        <View className="h-12 w-12 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />

        {/* Channel info skeleton */}
        <View className="flex-1 space-y-2">
          <View
            className="h-4 bg-neutral-300 dark:bg-neutral-600 rounded"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
          <View
            className="h-3 bg-neutral-300 dark:bg-neutral-600 rounded"
            style={{ width: `${40 + Math.random() * 40}%` }}
          />
        </View>

        {/* Action button skeleton */}
        <View className="h-8 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
      </View>
    </View>
  ));

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Header skeleton */}
      <View className="border-b border-neutral-200 dark:border-neutral-800 p-4">
        <View className="h-8 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse mb-4" />
        <View className="flex-row items-center space-x-3">
          <View className="h-6 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          <View className="h-6 w-16 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </View>
      </View>

      {/* Channel list skeleton */}
      <View className="flex-1">
        <View className="py-4">{skeletonChannels}</View>

        {/* Loading overlay */}
        <View className="absolute inset-0 items-center justify-center bg-white/50 dark:bg-black/50">
          <View className="rounded-xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
            <View className="items-center space-y-4">
              <View className="h-8 w-8 rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 animate-spin" />
              <View className="items-center space-y-2">
                <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Loading Channels
                </Text>
                <Text className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                  Getting your TV channels ready...
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
