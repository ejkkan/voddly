import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tvControl, TVStatus } from '../lib/tv-control';

interface Props {
  tvDeviceId: string;
}

export const TVRemoteControl: React.FC<Props> = ({ tvDeviceId }) => {
  const [tvStatus, setTvStatus] = useState<TVStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Start listening for TV status updates
    tvControl.startListening();
    setIsConnected(true);

    // Subscribe to status updates
    const unsubscribe = tvControl.onStatusUpdate((status) => {
      if (status.deviceId === tvDeviceId) {
        setTvStatus(status);
      }
    });

    return () => {
      unsubscribe();
      tvControl.stopListening();
      setIsConnected(false);
    };
  }, [tvDeviceId]);

  const handlePlay = async () => {
    const success = await tvControl.play(tvDeviceId);
    if (!success) {
      console.error('Failed to send play command');
    }
  };

  const handlePause = async () => {
    const success = await tvControl.pause(tvDeviceId);
    if (!success) {
      console.error('Failed to send pause command');
    }
  };

  const handleSeek = async (position: number) => {
    const success = await tvControl.seek(tvDeviceId, position);
    if (!success) {
      console.error('Failed to send seek command');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TV Remote Control</Text>
      
      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        {tvStatus && (
          <Text style={styles.statusText}>
            TV: {tvStatus.status} | Position: {tvStatus.currentPosition || 0}s
          </Text>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.playButton]} 
          onPress={handlePlay}
        >
          <Text style={styles.buttonText}>▶️ Play</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.pauseButton]} 
          onPress={handlePause}
        >
          <Text style={styles.buttonText}>⏸️ Pause</Text>
        </TouchableOpacity>
      </View>

      {/* Seek Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.seekButton]} 
          onPress={() => handleSeek((tvStatus?.currentPosition || 0) - 10)}
        >
          <Text style={styles.buttonText}>⏪ -10s</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.seekButton]} 
          onPress={() => handleSeek((tvStatus?.currentPosition || 0) + 10)}
        >
          <Text style={styles.buttonText}>⏩ +10s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusContainer: {
    backgroundColor: '#e8e8e8',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#4CAF50',
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  seekButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});