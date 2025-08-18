import React, { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Text, SafeAreaView } from '@/components/ui';
import { isTV, isWeb, platformSelector } from '@/lib/platform';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Mock video URLs - replace with actual streaming URLs
const getVideoUrl = (type: string, id: string) => {
  // This would normally fetch the actual stream URL from your backend
  return 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
};

export default function VideoPlayer() {
  const { type, id, title } = useLocalSearchParams<{
    type: 'movie' | 'series' | 'live';
    id: string;
    title: string;
  }>();
  const router = useRouter();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const videoUrl = getVideoUrl(type || 'movie', id || '1');
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Create video player instance
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = type === 'live';
    player.play();
  });

  // Hide status bar for fullscreen experience
  useEffect(() => {
    if (!isWeb) {
      StatusBar.setHidden(true);
    }

    return () => {
      if (!isWeb) {
        StatusBar.setHidden(false);
      }
    };
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (controlsVisible && player.playing) {
      controlsTimeout.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [controlsVisible, player.playing]);

  // Listen to player status changes
  useEffect(() => {
    const handlePlayingChange = () => {
      // Playing state is automatically tracked by the player
    };

    const handleDurationChange = () => {
      setDuration(player.duration * 1000); // Convert to milliseconds for consistency
    };

    const handleTimeUpdate = () => {
      setPosition(player.currentTime * 1000); // Convert to milliseconds for consistency
    };

    // Set up listeners
    const interval = setInterval(() => {
      handleTimeUpdate();
      handleDurationChange();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [player]);

  const togglePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleSeek = (value: number) => {
    player.currentTime = value / 1000; // Convert from milliseconds to seconds
  };

  const showControls = () => {
    setControlsVisible(true);
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Platform-specific styles
  const buttonSize = isTV ? 'p-4' : 'p-3';
  const iconSize = isTV ? 'text-4xl' : 'text-2xl';
  const textSize = isTV ? 'text-2xl' : 'text-lg';

  return (
    <View className="flex-1 bg-black">
      <TouchableOpacity
        activeOpacity={1}
        onPress={showControls}
        className="flex-1"
      >
        {/* Video Player */}
        <VideoView
          player={player}
          style={{
            width: screenWidth,
            height: screenHeight,
          }}
          allowsFullscreen={true}
          allowsPictureInPicture={true}
        />

        {/* Loading Indicator */}
        {player.status === 'loading' && (
          <View className="absolute inset-0 items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="mt-4 text-white">Loading...</Text>
          </View>
        )}

        {/* Controls Overlay */}
        {controlsVisible && player.status !== 'loading' && (
          <View className="absolute inset-0">
            {/* Gradient Background */}
            <View className="absolute inset-0 bg-black/30" />

            {/* Top Bar */}
            <SafeAreaView className="absolute left-0 right-0 top-0">
              <View className="flex-row items-center justify-between p-4">
                <TouchableOpacity
                  onPress={handleBack}
                  className={`rounded-full bg-black/50 ${buttonSize}`}
                >
                  <Text className={`${iconSize} text-white`}>←</Text>
                </TouchableOpacity>

                <View className="flex-1 mx-4">
                  <Text
                    className={`${textSize} font-semibold text-white`}
                    numberOfLines={1}
                  >
                    {title || 'Video Player'}
                  </Text>
                  {type === 'live' && (
                    <View className="mt-1 flex-row items-center">
                      <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                      <Text className="text-sm text-red-500">LIVE</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  className={`rounded-full bg-black/50 ${buttonSize}`}
                >
                  <Text className={`${iconSize} text-white`}>⚙️</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Center Controls */}
            <View className="absolute inset-0 flex-row items-center justify-center">
              <TouchableOpacity
                className={`mx-4 rounded-full bg-black/50 ${buttonSize}`}
              >
                <Text className={`${iconSize} text-white`}>⏪</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayPause}
                className={`mx-4 rounded-full bg-black/50 p-6`}
              >
                <Text className="text-5xl text-white">
                  {player.playing ? '⏸' : '▶️'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`mx-4 rounded-full bg-black/50 ${buttonSize}`}
              >
                <Text className={`${iconSize} text-white`}>⏩</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Bar - Progress for VOD only */}
            {type !== 'live' && (
              <View className="absolute bottom-0 left-0 right-0 bg-black/50 p-4">
                <View className="mb-2 flex-row items-center">
                  <Text className="text-sm text-white">
                    {formatTime(position)}
                  </Text>

                  <View className="mx-4 h-1 flex-1 rounded-full bg-gray-600">
                    <View
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(position / duration) * 100}%` }}
                    />
                  </View>

                  <Text className="text-sm text-white">
                    {formatTime(duration)}
                  </Text>
                </View>

                {/* Additional Controls */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row">
                    <TouchableOpacity className="mr-4">
                      <Text className="text-white">CC</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="mr-4">
                      <Text className="text-white">Audio</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity>
                    <Text className="text-white">Quality</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
