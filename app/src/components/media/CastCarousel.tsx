import React, { useState } from 'react';
import {
  FlatList,
  View,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image, Text } from '@/components/ui';

interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}

interface CastCarouselProps {
  cast?: CastMember[];
  title?: string;
}

export function CastCarousel({ cast, title = 'Cast' }: CastCarouselProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!cast || cast.length === 0) {
    return null;
  }

  const displayCast = isExpanded ? cast : cast.slice(0, 10);
  const { width: screenWidth } = Dimensions.get('window');
  const itemWidth = screenWidth < 768 ? 100 : 120;

  return (
    <View className="mt-6">
      <View className="mb-3 flex-row items-center justify-between px-4">
        <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          {title}
        </Text>
        {cast.length > 10 && (
          <Pressable onPress={() => setIsExpanded(!isExpanded)}>
            <Text className="text-sm text-blue-600 dark:text-blue-400">
              {isExpanded ? 'Show Less' : `Show All (${cast.length})`}
            </Text>
          </Pressable>
        )}
      </View>

      {isExpanded ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row px-4">
            {displayCast.map((member) => (
              <CastMemberCard
                key={member.id}
                member={member}
                width={itemWidth}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={displayCast}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <CastMemberCard member={item} width={itemWidth} />
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      )}
    </View>
  );
}

function CastMemberCard({
  member,
  width,
}: {
  member: CastMember;
  width: number;
}) {
  const profileUrl = member.profile_path
    ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
    : null;

  return (
    <View className="mr-3" style={{ width }}>
      <View className="mb-2 aspect-[2/3] overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800">
        {profileUrl ? (
          <Image
            source={{ uri: profileUrl }}
            contentFit="cover"
            className="h-full w-full"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-4xl">👤</Text>
          </View>
        )}
      </View>
      <Text
        className="text-xs font-medium text-neutral-900 dark:text-neutral-50"
        numberOfLines={1}
      >
        {member.name}
      </Text>
      {member.character && (
        <Text
          className="text-xs text-neutral-600 dark:text-neutral-400"
          numberOfLines={1}
        >
          {member.character}
        </Text>
      )}
    </View>
  );
}
