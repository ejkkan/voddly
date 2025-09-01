import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';
import { useCurrentProfile } from '@/hooks/ui/useCurrentProfile';
import { useCreateProfile, useProfiles } from '@/hooks/ui/useProfiles';

export function ProfileSelector() {
  const { data: profilesData, isLoading } = useProfiles();
  const { currentProfile, switchProfile: switchToProfile } =
    useCurrentProfile();
  const createProfile = useCreateProfile();
  const router = useRouter();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });

  const profiles = profilesData?.profiles || [];

  const handleCreateProfile = async () => {
    if (!formData.name.trim()) return;

    try {
      await createProfile.mutateAsync({
        name: formData.name.trim(),
      });
      setIsCreateModalOpen(false);
      setFormData({ name: '' });
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (profileId === currentProfile?.id) {
      setIsDropdownOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      await switchToProfile(profileId);
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Failed to switch profile:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreateNewProfile = () => {
    setIsDropdownOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleManageProfiles = () => {
    setIsDropdownOpen(false);
    router.push('/(app)/profiles');
  };

  if (isLoading || !currentProfile) {
    return (
      <View className="mb-4 rounded-md bg-neutral-100 p-3 dark:bg-neutral-800">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          Loading profiles...
        </Text>
      </View>
    );
  }

  return (
    <>
      <View className="mb-4">
        <Pressable
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          className="rounded-md border border-neutral-200 bg-neutral-100 p-3 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Current Profile
              </Text>
              <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {currentProfile.name}
              </Text>
              {currentProfile.is_owner && (
                <Text className="text-xs text-green-600 dark:text-green-400">
                  Owner
                </Text>
              )}
            </View>
            <Text className="text-lg text-neutral-500 dark:text-neutral-400">
              {isDropdownOpen ? '▲' : '▼'}
            </Text>
          </View>
        </Pressable>

        {isDropdownOpen && (
          <View className="mt-2 rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
            {profiles.map((profile) => (
              <Pressable
                key={profile.id}
                onPress={() => handleSwitchProfile(profile.id)}
                disabled={isSwitching}
                className={`border-b border-neutral-100 p-3 dark:border-neutral-700 ${
                  profile.id === currentProfile?.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                } ${isSwitching ? 'opacity-50' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium text-neutral-900 dark:text-neutral-50">
                    {profile.name}
                  </Text>
                  {profile.id === currentProfile?.id && (
                    <Text className="text-sm text-blue-600 dark:text-blue-400">
                      {isSwitching ? 'Switching...' : 'Current'}
                    </Text>
                  )}
                </View>
                {profile.is_owner && (
                  <Text className="text-xs text-green-600 dark:text-green-400">
                    Owner
                  </Text>
                )}
              </Pressable>
            ))}

            <View className="border-t border-neutral-100 dark:border-neutral-700">
              <Pressable
                onPress={handleCreateNewProfile}
                className="p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <Text className="font-medium text-blue-600 dark:text-blue-400">
                  + Create New Profile
                </Text>
              </Pressable>

              <Pressable
                onPress={handleManageProfiles}
                className="border-t border-neutral-100 p-3 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-700"
              >
                <Text className="font-medium text-neutral-600 dark:text-neutral-400">
                  Manage Profiles
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Create Profile Modal */}
      {isCreateModalOpen && (
        <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-black/50 p-4">
          <View className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800">
            <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Create New Profile
            </Text>

            <TextInput
              placeholder="Profile Name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              className="mb-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-50"
            />

            <View className="flex-row space-x-3">
              <Pressable
                onPress={() => setIsCreateModalOpen(false)}
                className="flex-1 rounded-md bg-neutral-300 px-4 py-2 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500"
              >
                <Text className="text-center font-medium text-neutral-700 dark:text-neutral-300">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreateProfile}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                disabled={!formData.name.trim()}
              >
                <Text className="text-center font-medium text-white">
                  Create
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
