import React from 'react';
import { View, Text, Pressable } from '@/components/ui';

export function PlaylistCard({
  id,
  name,
  providerType,
  channels,
  isLoading,
  isActiveReload,
  onReload,
}: {
  id: string;
  name: string;
  providerType: string;
  channels?: number;
  isLoading?: boolean;
  isActiveReload?: boolean;
  onReload: (id: string) => void;
}) {
  const provider = (providerType || '').toLowerCase();
  const label = provider === 'xtream' ? 'IPTV Xtream' : provider.toUpperCase();

  return (
    <View className="mb-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
        {name}
      </Text>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {label}
        {typeof channels === 'number' ? ` • ${channels} channels` : ''}
      </Text>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
        ID: {id}
      </Text>
      <View className="mt-3 flex-row gap-3">
        <Pressable
          disabled={!!isLoading}
          className={`rounded-xl px-3 py-2 ${
            isLoading && isActiveReload
              ? 'opacity-60 border border-neutral-300 dark:border-neutral-700'
              : 'bg-neutral-900'
          }`}
          onPress={() => onReload(id)}
        >
          <Text
            className={
              isLoading && isActiveReload
                ? 'text-neutral-800 dark:text-neutral-200'
                : 'text-white'
            }
          >
            {isLoading && isActiveReload ? 'Reloading…' : 'Reload'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
