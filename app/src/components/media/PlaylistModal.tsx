import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';

import { Checkbox } from '../ui';

interface PlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  contentId: string | number;
  contentTitle?: string;
}

export function PlaylistModal({
  visible,
  onClose,
  contentId,
  contentTitle,
}: PlaylistModalProps) {
  const {
    playlists,
    isLoading,
    isInPlaylist,
    togglePlaylistItem,
    createPlaylist,
  } = usePlaylistManager();

  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTogglePlaylist = async (playlistId: string) => {
    setIsProcessing(true);
    await togglePlaylistItem(playlistId, contentId);
    setIsProcessing(false);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    setIsProcessing(true);
    try {
      const result = await createPlaylist.mutateAsync(newPlaylistName);
      if (result?.id) {
        await togglePlaylistItem(result.id, contentId);
      }
      setNewPlaylistName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
    setIsProcessing(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to Playlist</Text>
            {contentTitle && (
              <Text style={styles.subtitle}>{contentTitle}</Text>
            )}
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color="#fff"
              style={styles.loader}
            />
          ) : (
            <>
              {playlists.length === 0 && !isCreating ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No playlists yet</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setIsCreating(true)}
                  >
                    <Text style={styles.createButtonText}>
                      Create your first playlist
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <FlatList
                    data={playlists}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.playlistItem}
                        onPress={() => handleTogglePlaylist(item.id)}
                        disabled={isProcessing}
                      >
                        <Checkbox
                          checked={isInPlaylist(contentId, item.id)}
                          onPress={() => handleTogglePlaylist(item.id)}
                          disabled={isProcessing}
                          checkedColor="#007AFF"
                          containerStyle={styles.checkbox}
                        />
                        <View style={styles.playlistInfo}>
                          <Text style={styles.playlistName}>{item.name}</Text>
                          <Text style={styles.playlistCount}>
                            {item.items?.length || 0} items
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    style={styles.list}
                  />

                  {!isCreating && (
                    <TouchableOpacity
                      style={styles.addNewButton}
                      onPress={() => setIsCreating(true)}
                    >
                      <Text style={styles.addNewButtonText}>
                        + Create new playlist
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {isCreating && (
                <View style={styles.createForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Playlist name"
                    placeholderTextColor="#999"
                    value={newPlaylistName}
                    onChangeText={setNewPlaylistName}
                    autoFocus
                  />
                  <View style={styles.createActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setIsCreating(false);
                        setNewPlaylistName('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        !newPlaylistName.trim() && styles.saveButtonDisabled,
                      ]}
                      onPress={handleCreatePlaylist}
                      disabled={!newPlaylistName.trim() || isProcessing}
                    >
                      <Text style={styles.saveButtonText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
  },
  loader: {
    marginVertical: 40,
  },
  list: {
    maxHeight: 300,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  checkbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 10,
  },
  playlistName: {
    fontSize: 16,
    color: '#fff',
  },
  playlistCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addNewButton: {
    marginTop: 15,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addNewButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  createForm: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 20,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#444',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
