import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Pressable, Text, View } from '@/components/ui';
import {
  useAccountSources,
  useProfileSources,
  useUpdateProfileSources,
} from '@/hooks/ui/useProfileSources';

interface ProfileSourceManagerProps {
  profileId: string;
  profileName: string;
  onClose: () => void;
}

export default function ProfileSourceManager({
  profileId,
  profileName,
  onClose,
}: ProfileSourceManagerProps) {
  const { data: accountSourcesData, isLoading: isLoadingAccountSources } =
    useAccountSources();
  const { data: profileSourcesData, isLoading: isLoadingProfileSources } =
    useProfileSources(profileId);
  const updateProfileSources = useUpdateProfileSources();

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Memoize derived values to prevent unnecessary re-renders
  const accountSources = useMemo(
    () => accountSourcesData?.sources || [],
    [accountSourcesData?.sources]
  );
  const profileSources = useMemo(
    () => profileSourcesData?.sources || [],
    [profileSourcesData?.sources]
  );

  // Initialize selected sources when profile sources load
  useEffect(() => {
    // Only update if we have new data and it's different from current selection
    if (profileSourcesData?.sources) {
      const restrictedSourceIds = profileSourcesData.sources
        .filter((source) => source.is_restricted)
        .map((source) => source.id);

      // Only update if the selection actually changed
      setSelectedSourceIds((prev) => {
        if (prev.length !== restrictedSourceIds.length)
          return restrictedSourceIds;
        if (prev.some((id) => !restrictedSourceIds.includes(id)))
          return restrictedSourceIds;
        if (restrictedSourceIds.some((id) => !prev.includes(id)))
          return restrictedSourceIds;
        return prev; // No change needed
      });
    } else {
      setSelectedSourceIds([]);
    }
  }, [profileSourcesData?.sources]); // Use the original data instead of derived value

  const handleSourceToggle = useCallback((sourceId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await updateProfileSources.mutateAsync({
        profileId,
        sourceIds: selectedSourceIds,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update profile sources:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, selectedSourceIds, notes, updateProfileSources, onClose]);

  const handleRemoveRestrictions = useCallback(async () => {
    setIsLoading(true);
    try {
      await updateProfileSources.mutateAsync({
        profileId,
        sourceIds: [],
        notes: 'Source restrictions removed',
      });
      onClose();
    } catch (error) {
      console.error('Failed to remove source restrictions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, updateProfileSources, onClose]);

  if (isLoadingAccountSources || isLoadingProfileSources) {
    return (
      <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-black/50 p-4">
        <View className="w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-neutral-800">
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            Loading sources...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-black/50 p-4">
      <View className="max-h-[80vh] w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-neutral-800">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Manage Sources for {profileName}
          </Text>
          <Pressable
            onPress={onClose}
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <Text className="text-2xl">×</Text>
          </Pressable>
        </View>

        <Text className="mb-4 text-neutral-600 dark:text-neutral-400">
          Select which sources this profile can access. Leave empty to allow
          access to all sources.
        </Text>

        {/* Source selection */}
        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Available Sources ({accountSources.length})
          </Text>

          {accountSources.length === 0 ? (
            <Text className="py-4 text-center text-neutral-500 dark:text-neutral-400">
              No sources available for this account
            </Text>
          ) : (
            <View className="max-h-64 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700">
              {accountSources.map((source) => (
                <Pressable
                  key={source.id}
                  onPress={() => handleSourceToggle(source.id)}
                  className={`flex-row items-center border-b border-neutral-100 p-3 dark:border-neutral-800 ${
                    selectedSourceIds.includes(source.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  <View
                    className={`mr-3 size-5 items-center justify-center rounded border ${
                      selectedSourceIds.includes(source.id)
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {selectedSourceIds.includes(source.id) && (
                      <Text className="text-sm text-white">✓</Text>
                    )}
                  </View>

                  <View className="flex-1">
                    <Text className="font-medium text-neutral-900 dark:text-neutral-50">
                      {source.name}
                    </Text>
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                      {source.provider_type} • Created{' '}
                      {new Date(source.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Current restrictions info */}
        {profileSources.filter((s) => s.is_restricted).length > 0 && (
          <View className="mb-6 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
            <Text className="text-sm text-orange-800 dark:text-orange-200">
              This profile currently has access to{' '}
              {profileSources.filter((s) => s.is_restricted).length} sources.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View className="flex-row space-x-3">
          <Pressable
            onPress={onClose}
            className="flex-1 rounded-md bg-neutral-300 px-4 py-2 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500"
          >
            <Text className="text-center font-medium text-neutral-700 dark:text-neutral-300">
              Cancel
            </Text>
          </Pressable>

          {profileSources.filter((s) => s.is_restricted).length > 0 && (
            <Pressable
              onPress={handleRemoveRestrictions}
              className="flex-1 rounded-md bg-red-100 px-4 py-2 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800"
              disabled={isLoading}
            >
              <Text className="text-center font-medium text-red-700 dark:text-red-300">
                Remove All Restrictions
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSave}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            disabled={isLoading}
          >
            <Text className="text-center font-medium text-white">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
