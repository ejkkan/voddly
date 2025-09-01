import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput } from 'react-native';

import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { useCreateProfile, useProfiles } from '@/hooks/ui/useProfiles';
import { useProfileStore } from '@/lib/profile-store';

export default function ProfilePickerScreen() {
  const router = useRouter();
  const { data: profilesData, isLoading } = useProfiles();
  const { setCurrentProfileId, currentProfileId } = useProfileStore();
  const createProfile = useCreateProfile();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const profiles = profilesData?.profiles || [];

  // Show create form if no profiles exist
  React.useEffect(() => {
    if (!isLoading && profiles.length === 0) {
      setShowCreateForm(true);
    }
  }, [isLoading, profiles.length]);

  const handleSelectProfile = (profileId: string) => {
    setCurrentProfileId(profileId);
    // Navigate to dashboard after selecting profile
    router.replace('/(app)/dashboard');
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;

    setIsCreating(true);
    try {
      const result = await createProfile.mutateAsync({
        name: newProfileName.trim(),
        hasSourceRestrictions: false,
        allowedSources: [],
      });

      if (result?.profile?.id) {
        setCurrentProfileId(result.profile.id);
        // Navigate to dashboard after creating profile
        router.replace('/(app)/dashboard');
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
      setIsCreating(false);
      setNewProfileName('');
      setShowCreateForm(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Text className="text-lg text-neutral-600 dark:text-neutral-400">
          Loading profiles...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-md">
          <Text className="mb-2 text-center text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            {profiles.length === 0
              ? 'Create Your Profile'
              : 'Choose Your Profile'}
          </Text>
          <Text className="mb-8 text-center text-neutral-600 dark:text-neutral-400">
            {profiles.length === 0
              ? 'Create a profile to get started'
              : 'Select a profile to continue'}
          </Text>

          {/* Profile List */}
          {profiles.length > 0 && (
            <View className="mb-6 space-y-3">
              {profiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  onPress={() => handleSelectProfile(profile.id)}
                  className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                        {profile.name}
                      </Text>
                      {profile.is_owner && (
                        <Text className="text-sm text-green-600 dark:text-green-400">
                          Owner Profile
                        </Text>
                      )}
                    </View>
                    <Text className="text-2xl text-neutral-400">→</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Create Profile Section */}
          {!showCreateForm ? (
            <Pressable
              onPress={() => setShowCreateForm(true)}
              className="rounded-lg border-2 border-dashed border-neutral-300 bg-white p-4 hover:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:border-blue-400"
            >
              <Text className="text-center font-medium text-blue-600 dark:text-blue-400">
                + Create New Profile
              </Text>
            </Pressable>
          ) : (
            <View className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
              <Text className="mb-3 font-semibold text-neutral-900 dark:text-neutral-50">
                New Profile
              </Text>
              <TextInput
                placeholder="Enter profile name"
                value={newProfileName}
                onChangeText={setNewProfileName}
                autoFocus
                className="mb-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-50"
              />
              <View className="flex-row space-x-3">
                <Pressable
                  onPress={() => {
                    setShowCreateForm(false);
                    setNewProfileName('');
                  }}
                  disabled={isCreating}
                  className="flex-1 rounded-md bg-neutral-200 px-4 py-2 hover:bg-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-500"
                >
                  <Text className="text-center font-medium text-neutral-700 dark:text-neutral-300">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCreateProfile}
                  disabled={!newProfileName.trim() || isCreating}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <Text className="text-center font-medium text-white">
                    {isCreating ? 'Creating...' : 'Create'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Help Text */}
          {profiles.length === 0 && !showCreateForm && (
            <Text className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No profiles found. Create your first profile to get started.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
