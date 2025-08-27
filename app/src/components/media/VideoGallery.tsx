import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { Image, Text } from '@/components/ui';

interface VideoItem {
  id?: string;
  key: string;
  name: string;
  site: string;
  type?: string;
  size?: number;
}

interface VideoGalleryProps {
  videos?: VideoItem[];
  trailerUrl?: string;
  title?: string;
}

export function VideoGallery({
  videos = [],
  trailerUrl,
  title = 'Videos',
}: VideoGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Add trailer URL as a video if provided
  const allVideos = [...videos];
  if (trailerUrl && !videos.some((v) => v.key === getYouTubeId(trailerUrl))) {
    const youtubeId = getYouTubeId(trailerUrl);
    if (youtubeId) {
      allVideos.unshift({
        key: youtubeId,
        name: 'Official Trailer',
        site: 'YouTube',
        type: 'Trailer',
      });
    }
  }

  if (allVideos.length === 0) {
    return null;
  }

  const displayVideos = isExpanded ? allVideos : allVideos.slice(0, 4);
  const { width: screenWidth } = Dimensions.get('window');
  const thumbWidth = screenWidth < 768 ? 280 : 320;

  return (
    <>
      <View className="mt-6">
        <View className="mb-3 flex-row items-center justify-between px-4">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {title}
          </Text>
          {allVideos.length > 4 && (
            <Pressable onPress={() => setIsExpanded(!isExpanded)}>
              <Text className="text-sm text-blue-600 dark:text-blue-400">
                {isExpanded ? 'Show Less' : `Show All (${allVideos.length})`}
              </Text>
            </Pressable>
          )}
        </View>

        <FlatList
          data={displayVideos}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          renderItem={({ item }) => (
            <VideoThumbnail
              video={item}
              width={thumbWidth}
              onPress={() => setSelectedVideo(item)}
            />
          )}
          keyExtractor={(item) => item.key}
        />
      </View>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  );
}

function VideoThumbnail({
  video,
  width,
  onPress,
}: {
  video: VideoItem;
  width: number;
  onPress: () => void;
}) {
  const height = width * 0.56;
  const thumbnailUrl = `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-lg bg-neutral-900"
      style={{ width, height }}
    >
      <Image
        source={{ uri: thumbnailUrl }}
        contentFit="cover"
        className="size-full"
      />
      {/* Play button overlay */}
      <View className="absolute inset-0 items-center justify-center bg-black/30">
        <View className="size-12 items-center justify-center rounded-full bg-white/90">
          <Text className="ml-1 text-2xl text-black">▶</Text>
        </View>
      </View>
      {/* Video info */}
      <View className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <Text className="text-sm font-medium text-white" numberOfLines={1}>
          {video.name}
        </Text>
        {video.type && (
          <Text className="text-xs text-white/70">{video.type}</Text>
        )}
      </View>
    </Pressable>
  );
}

function VideoPlayerModal({
  video,
  onClose,
}: {
  video: VideoItem;
  onClose: () => void;
}) {
  const { width: screenWidth } = Dimensions.get('window');

  if (Platform.OS === 'web') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <Pressable className="flex-1 bg-black/95" onPress={onClose}>
          <View className="flex-1 items-center justify-center">
            <View
              style={{
                width: Math.min(screenWidth * 0.9, 800),
                height: Math.min(screenWidth * 0.9, 800) * 0.56,
              }}
              className="overflow-hidden rounded-lg bg-black"
            >
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.key}?autoplay=1`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </View>
            <Text className="mt-4 text-lg font-medium text-white">
              {video.name}
            </Text>
          </View>
          <Pressable
            className="absolute right-4 top-12 rounded-full bg-white/20 p-3"
            onPress={onClose}
          >
            <Text className="text-2xl text-white">✕</Text>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // For native platforms, open YouTube in external browser
  React.useEffect(() => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${video.key}`;
    Linking.openURL(youtubeUrl);
    onClose();
  }, [video.key, onClose]);

  // Return null for native platforms since we're opening in browser
  return null;
}

function getYouTubeId(url: string): string | null {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
