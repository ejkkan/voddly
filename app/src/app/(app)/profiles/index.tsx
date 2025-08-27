import React, { useState, useCallback } from 'react';
import { TextInput } from 'react-native';

import ProfileSourceManager from '@/components/profiles/ProfileSourceManager';
import { Pressable, Text, View } from '@/components/ui';
import {
  useCreateProfile,
  useDeleteProfile,
  useProfiles,
  useUpdateProfile,
} from '@/hooks/ui/useProfiles';

export default function ProfilesPage() {
  const { data: profilesData, isLoading, refetch } = useProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSourceManagerOpen, setIsSourceManagerOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
  });

  const profiles = profilesData?.profiles || [];

  // Find the owner profile
  const ownerProfile = profiles.find((profile) => profile.is_owner);

  const handleCreateProfile = useCallback(async () => {
    if (!formData.name.trim()) return;

    try {
      await createProfile.mutateAsync({
        name: formData.name.trim(),
      });
      setIsCreateModalOpen(false);
      setFormData({ name: '' });
      refetch();
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  }, [formData.name, createProfile, refetch]);

  const handleEditProfile = useCallback(async () => {
    if (!editingProfile || !formData.name.trim()) return;

    try {
      await updateProfile.mutateAsync({
        profileId: editingProfile.id,
        name: formData.name.trim(),
      });
      setIsEditModalOpen(false);
      setEditingProfile(null);
      setFormData({ name: '' });
      refetch();
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }, [editingProfile, formData.name, updateProfile, refetch]);

  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      if (
        !confirm(
          'Are you sure you want to delete this profile? This action cannot be undone.'
        )
      ) {
        return;
      }

      try {
        await deleteProfile.mutateAsync({ profileId });
        refetch();
      } catch (error) {
        console.error('Failed to delete profile:', error);
      }
    },
    [deleteProfile, refetch]
  );

  const openEditModal = useCallback((profile: any) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleSourceManagerClose = useCallback(() => {
    setIsSourceManagerOpen(false);
    setEditingProfile(null);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading profiles...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-6">
      <View className="mb-6">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          Profiles
        </Text>
        <Text className="mt-2 text-neutral-600 dark:text-neutral-400">
          Manage your account profiles
        </Text>
      </View>

      <Pressable
        onPress={() => setIsCreateModalOpen(true)}
        className="mb-6 self-start rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        <Text className="font-medium text-white">Create New Profile</Text>
      </Pressable>

      <View className="space-y-4">
        {profiles.map((profile) => (
          <View
            key={profile.id}
            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center space-x-2">
                  <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    {profile.name}
                  </Text>
                  {profile.is_owner && (
                    <View className="rounded-full bg-green-100 px-2 py-1 dark:bg-green-900">
                      <Text className="text-xs font-medium text-green-800 dark:text-green-200">
                        Owner
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Created: {new Date(profile.created_at).toLocaleDateString()}
                </Text>
                <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Sources:{' '}
                  {profile.is_owner
                    ? 'All sources (Owner)'
                    : 'Manage via Sources button'}
                </Text>
              </View>

              <View className="flex-row space-x-2">
                {/* Edit button - owner can edit all profiles */}
                <Pressable
                  onPress={() => openEditModal(profile)}
                  className="rounded-md bg-neutral-100 px-3 py-2 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600"
                >
                  <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Edit
                  </Text>
                </Pressable>

                {/* Sources button - owner can manage sources for all profiles except their own */}
                {!profile.is_owner && (
                  <Pressable
                    onPress={() => {
                      setEditingProfile(profile);
                      setIsSourceManagerOpen(true);
                    }}
                    className="rounded-md bg-blue-100 px-3 py-2 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800"
                  >
                    <Text className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Sources
                    </Text>
                  </Pressable>
                )}

                {/* Delete button - owner cannot delete their own profile, but can delete others */}
                {profile.is_owner ? (
                  <View className="rounded-md bg-neutral-100 px-3 py-2 dark:bg-neutral-700">
                    <Text className="text-sm font-medium text-neutral-400 dark:text-neutral-500">
                      Cannot Delete
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleDeleteProfile(profile.id)}
                    className="rounded-md bg-red-100 px-3 py-2 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800"
                  >
                    <Text className="text-sm font-medium text-red-700 dark:text-red-300">
                      Delete
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Create Profile Modal */}
      {isCreateModalOpen && (
        <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-black/50 p-4">
          <View className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800">
            <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Create New Profile
            </Text>

            <View className="mb-4 flex-row items-center">
              <Text className="text-neutral-700 dark:text-neutral-300">
                Profile name
              </Text>
            </View>

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

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-black/50 p-4">
          <View className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800">
            <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Edit Profile
            </Text>

            <View className="mb-4 flex-row items-center">
              <Text className="text-neutral-700 dark:text-neutral-300">
                Profile name
              </Text>
            </View>

            <TextInput
              placeholder="Profile Name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              className="mb-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-50"
            />

            <View className="flex-row space-x-3">
              <Pressable
                onPress={() => setIsEditModalOpen(false)}
                className="flex-1 rounded-md bg-neutral-300 px-4 py-2 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500"
              >
                <Text className="text-center font-medium text-neutral-700 dark:text-neutral-300">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleEditProfile}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                disabled={!formData.name.trim()}
              >
                <Text className="text-center font-medium text-white">
                  Update
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Profile Source Manager Modal */}
      {isSourceManagerOpen && editingProfile && (
        <ProfileSourceManager
          profileId={editingProfile.id}
          profileName={editingProfile.name}
          onClose={handleSourceManagerClose}
        />
      )}
    </View>
  );
}
