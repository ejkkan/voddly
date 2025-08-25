import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  View,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Image, Text } from '@/components/ui';

interface ImageItem {
  file_path: string;
  aspect_ratio?: number;
  width?: number;
  height?: number;
}

interface ImageGalleryProps {
  posters?: ImageItem[];
  backdrops?: ImageItem[];
  title?: string;
}

export function ImageGallery({
  posters = [],
  backdrops = [],
  title = 'Images',
}: ImageGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posters' | 'backdrops'>(
    'backdrops'
  );

  const hasImages = posters.length > 0 || backdrops.length > 0;
  if (!hasImages) {
    return null;
  }

  const { width: screenWidth } = Dimensions.get('window');
  const thumbWidth = screenWidth < 768 ? 150 : 200;

  const currentImages = activeTab === 'posters' ? posters : backdrops;
  const displayImages = isExpanded ? currentImages : currentImages.slice(0, 8);

  return (
    <>
      <View className="mt-6">
        <View className="mb-3 flex-row items-center justify-between px-4">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {title}
          </Text>
          {currentImages.length > 8 && (
            <Pressable onPress={() => setIsExpanded(!isExpanded)}>
              <Text className="text-sm text-blue-600 dark:text-blue-400">
                {isExpanded
                  ? 'Show Less'
                  : `Show All (${currentImages.length})`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        {posters.length > 0 && backdrops.length > 0 && (
          <View className="mb-3 flex-row gap-2 px-4">
            <Pressable
              onPress={() => setActiveTab('backdrops')}
              className={`rounded-lg px-4 py-2 ${
                activeTab === 'backdrops'
                  ? 'bg-neutral-900 dark:bg-neutral-100'
                  : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === 'backdrops'
                    ? 'text-white dark:text-black'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                Backdrops ({backdrops.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('posters')}
              className={`rounded-lg px-4 py-2 ${
                activeTab === 'posters'
                  ? 'bg-neutral-900 dark:bg-neutral-100'
                  : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === 'posters'
                    ? 'text-white dark:text-black'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                Posters ({posters.length})
              </Text>
            </Pressable>
          </View>
        )}

        {/* Image Grid */}
        {isExpanded ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4"
          >
            <View className="flex-row gap-3">
              {displayImages.map((image, index) => (
                <ImageThumbnail
                  key={index}
                  image={image}
                  width={thumbWidth}
                  isPortrait={activeTab === 'posters'}
                  onPress={() =>
                    setSelectedImage(
                      `https://image.tmdb.org/t/p/original${image.file_path}`
                    )
                  }
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={displayImages}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => (
              <ImageThumbnail
                image={item}
                width={thumbWidth}
                isPortrait={activeTab === 'posters'}
                onPress={() =>
                  setSelectedImage(
                    `https://image.tmdb.org/t/p/original${item.file_path}`
                  )
                }
              />
            )}
            keyExtractor={(_, index) => index.toString()}
          />
        )}
      </View>

      {/* Full-screen image viewer */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable
          className="flex-1 bg-black/95"
          onPress={() => setSelectedImage(null)}
        >
          <View className="flex-1 items-center justify-center">
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                contentFit="contain"
                className="h-full w-full"
              />
            )}
          </View>
          <Pressable
            className="absolute right-4 top-12 rounded-full bg-white/20 p-3"
            onPress={() => setSelectedImage(null)}
          >
            <Text className="text-2xl text-white">✕</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ImageThumbnail({
  image,
  width,
  isPortrait,
  onPress,
}: {
  image: ImageItem;
  width: number;
  isPortrait: boolean;
  onPress: () => void;
}) {
  const height = isPortrait ? width * 1.5 : width * 0.56;
  const imageUrl = `https://image.tmdb.org/t/p/w500${image.file_path}`;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800"
      style={{ width, height }}
    >
      <Image
        source={{ uri: imageUrl }}
        contentFit="cover"
        className="h-full w-full"
      />
    </Pressable>
  );
}
