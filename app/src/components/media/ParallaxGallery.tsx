import React, { useMemo } from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { MotiView, useAnimationState } from 'moti';
import { Image } from '@/components/ui';

interface ParallaxGalleryProps {
  posters?: Array<{ file_path: string; aspect_ratio: number }>;
  backdrops?: Array<{ file_path: string; aspect_ratio: number }>;
}

export const ParallaxGallery: React.FC<ParallaxGalleryProps> = ({
  posters,
  backdrops,
}) => {
  const { width: screenWidth } = Dimensions.get('window');
  
  const allImages = useMemo(() => {
    const images: Array<{ url: string; aspectRatio: number; type: 'poster' | 'backdrop' }> = [];
    
    // Add posters
    if (posters) {
      posters.slice(0, 10).forEach((poster) => {
        images.push({
          url: `https://image.tmdb.org/t/p/w500${poster.file_path}`,
          aspectRatio: poster.aspect_ratio,
          type: 'poster'
        });
      });
    }
    
    // Add backdrops
    if (backdrops) {
      backdrops.slice(0, 8).forEach((backdrop) => {
        images.push({
          url: `https://image.tmdb.org/t/p/w780${backdrop.file_path}`,
          aspectRatio: backdrop.aspect_ratio,
          type: 'backdrop'
        });
      });
    }
    
    // Shuffle for more interesting layout
    return images.sort(() => Math.random() - 0.5);
  }, [posters, backdrops]);

  // Split into three columns
  const third = Math.ceil(allImages.length / 3);
  const firstColumn = allImages.slice(0, third);
  const secondColumn = allImages.slice(third, 2 * third);
  const thirdColumn = allImages.slice(2 * third);

  const getImageHeight = (aspectRatio: number, type: 'poster' | 'backdrop') => {
    const columnWidth = (screenWidth - 48) / 3; // Account for padding and gaps
    if (type === 'poster') {
      return columnWidth / aspectRatio;
    } else {
      return (columnWidth / aspectRatio) * 0.8; // Make backdrops a bit shorter
    }
  };

  const ParallaxColumn = ({ 
    images, 
    direction = 1 
  }: { 
    images: Array<{ url: string; aspectRatio: number; type: 'poster' | 'backdrop' }>; 
    direction?: number;
  }) => (
    <View className="flex-1 gap-3">
      {images.map((image, idx) => (
        <MotiView
          key={`${image.url}-${idx}`}
          from={{ translateY: direction * 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{
            type: 'timing',
            duration: 800,
            delay: idx * 150,
          }}
        >
          <View 
            className="rounded-2xl overflow-hidden bg-white/5"
            style={{ 
              height: getImageHeight(image.aspectRatio, image.type),
            }}
          >
            <Image
              source={{ uri: image.url }}
              contentFit="cover"
              className="size-full"
            />
          </View>
        </MotiView>
      ))}
    </View>
  );

  if (allImages.length === 0) {
    return null;
  }

  return (
    <View className="h-96">
      <View className="flex-row gap-3 h-full">
        <ParallaxColumn images={firstColumn} direction={1} />
        <ParallaxColumn images={secondColumn} direction={-1} />
        <ParallaxColumn images={thirdColumn} direction={1} />
      </View>
    </View>
  );
};