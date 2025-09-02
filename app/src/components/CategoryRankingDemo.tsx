/**
 * Demo component showing category ranking with sample data
 */

import React from 'react';
import { View, Text, ScrollView } from '@/components/ui';
import {
  rankCategories,
  getHighlightedCategories,
  type Category,
  type LiveStream,
} from '@/lib/category-ranking';

// Sample data from your IPTV provider
const sampleCategories: Category[] = [
  { category_id: '4', category_name: 'Sweden' },
  { category_id: '705', category_name: 'Allsvenskan & Superettan SE' },
  { category_id: '621', category_name: 'Max Sports SE' },
  { category_id: '648', category_name: 'Max Sports SE [B]' },
  { category_id: '480', category_name: 'Viaplay Sport SE' },
  { category_id: '688', category_name: 'Viaplay Sport SE [B]' },
  { category_id: '528', category_name: 'TV4 Play SE' },
  { category_id: '628', category_name: 'Prime Sports SE' },
  { category_id: '691', category_name: 'Prime Sports SE [B]' },
  { category_id: '708', category_name: 'DAZN SE' },
  { category_id: '635', category_name: 'Disney Plus SE' },
  { category_id: '476', category_name: 'Discovery+ Sport SE' },
  { category_id: '532', category_name: '24/7 Swedish' },
  { category_id: '531', category_name: '24/7 Movies' },
  { category_id: '7', category_name: 'Denmark' },
  { category_id: '589', category_name: 'Max Sports DK' },
  { category_id: '9', category_name: 'Norway' },
  { category_id: '79', category_name: 'Finland' },
  { category_id: '513', category_name: 'Iceland' },
];

// Sample streams for Sweden category
const swedenStreams: LiveStream[] = [
  {
    stream_id: 26592,
    name: 'SVT1 Skåne SE',
    stream_type: 'live',
    stream_icon:
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/nordic/sweden/svt1-se.png',
    epg_channel_id: 'svt1.se',
    is_adult: 0,
    tv_archive: 1,
    tv_archive_duration: '3',
    category_id: '4',
  },
  {
    stream_id: 24639,
    name: 'SVT1 HD SE',
    stream_type: 'live',
    stream_icon:
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/nordic/sweden/svt1-se.png',
    epg_channel_id: 'svt1.se',
    is_adult: 0,
    tv_archive: 0,
    category_id: '4',
  },
  {
    stream_id: 9654,
    name: 'SVT2 HD SE',
    stream_type: 'live',
    stream_icon:
      'https://logo.mypanel.one/tv-logos-main/tv-logos-main/countries/nordic/sweden/svt2-se.png',
    epg_channel_id: 'svt2.se',
    is_adult: 0,
    tv_archive: 0,
    category_id: '4',
  },
  {
    stream_id: 38080,
    name: 'TV4 HD SE',
    stream_type: 'live',
    stream_icon:
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/nordic/sweden/tv4-se.png',
    epg_channel_id: 'tv4.se',
    is_adult: 0,
    tv_archive: 0,
    category_id: '4',
  },
  {
    stream_id: 10051,
    name: 'Kanal 5 HD SE',
    stream_type: 'live',
    stream_icon: 'https://i.ibb.co/TKQ7t35/Kanal5nylogga.png',
    epg_channel_id: 'kanal5.se',
    is_adult: 0,
    tv_archive: 0,
    category_id: '4',
  },
];

// Sample streams for sports category
const sportsStreams: LiveStream[] = [
  {
    stream_id: 952994,
    name: 'Viasat Sport Premium SE',
    stream_type: 'live',
    stream_icon: 'https://example.com/viasat-sport.png',
    epg_channel_id: 'viasatsportpremium.se',
    is_adult: 0,
    tv_archive: 1,
    tv_archive_duration: '2',
    category_id: '480',
  },
  {
    stream_id: 123456,
    name: 'Max Sport 1 HD SE',
    stream_type: 'live',
    stream_icon: 'https://example.com/max-sport.png',
    epg_channel_id: 'maxsport1.se',
    is_adult: 0,
    tv_archive: 0,
    category_id: '621',
  },
];

export default function CategoryRankingDemo() {
  // Create stream mapping
  const streamsByCategory = new Map<string, LiveStream[]>();
  streamsByCategory.set('4', swedenStreams);
  streamsByCategory.set('480', sportsStreams);
  streamsByCategory.set('621', sportsStreams);

  // Add mock streams for other categories
  sampleCategories.forEach((cat) => {
    if (!streamsByCategory.has(cat.category_id)) {
      const mockStreamCount = Math.floor(Math.random() * 20) + 5;
      const mockStreams: LiveStream[] = Array.from(
        { length: mockStreamCount },
        (_, i) => ({
          stream_id: parseInt(cat.category_id) * 1000 + i,
          name: `Channel ${i + 1} ${cat.category_name}`,
          stream_type: 'live',
          epg_channel_id: Math.random() > 0.5 ? `channel${i}.example` : '',
          is_adult: 0,
          tv_archive: Math.random() > 0.7 ? 1 : 0,
          category_id: cat.category_id,
        })
      );
      streamsByCategory.set(cat.category_id, mockStreams);
    }
  });

  // Rank categories
  const rankedCategories = rankCategories(sampleCategories, streamsByCategory);
  const highlightedCategories = getHighlightedCategories(rankedCategories, 5);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHighlightBadge = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <View className="flex-1 p-4">
      <Text className="mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
        Category Ranking Demo
      </Text>

      <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        This demo shows how categories are ranked based on content quality,
        geographic relevance, and user engagement factors.
      </Text>

      {/* Highlighted Categories Section */}
      <View className="mb-6">
        <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          🌟 Top Recommended Categories
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        >
          {highlightedCategories.map((category) => (
            <View
              key={category.categoryId}
              className="mr-3 w-64 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
            >
              <Text className="font-semibold text-green-900 dark:text-green-100">
                {category.name}
              </Text>
              <Text className="mt-1 text-sm text-green-700 dark:text-green-300">
                Score: {category.totalScore}/100
              </Text>
              <Text className="mt-1 text-xs text-green-600 dark:text-green-400">
                {category.recommendationReason.join(' • ')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* All Categories Ranked */}
      <View className="flex-1">
        <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          📊 All Categories (Ranked by Score)
        </Text>
        <ScrollView className="flex-1">
          {rankedCategories.map((category, index) => (
            <View
              key={category.categoryId}
              className="mb-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="mr-2 text-sm font-mono text-neutral-500">
                      #{index + 1}
                    </Text>
                    <Text className="font-semibold text-neutral-900 dark:text-neutral-50">
                      {category.name}
                    </Text>
                    <View
                      className={`ml-2 rounded-full px-2 py-1 ${getHighlightBadge(category.highlightLevel)}`}
                    >
                      <Text className="text-xs font-medium">
                        {category.highlightLevel.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-2 flex-row flex-wrap">
                    <Text className="mr-4 text-xs text-neutral-600 dark:text-neutral-400">
                      Channels: {category.factors.channelCount}
                    </Text>
                    <Text className="mr-4 text-xs text-neutral-600 dark:text-neutral-400">
                      EPG: {category.factors.epgAvailability}
                    </Text>
                    <Text className="mr-4 text-xs text-neutral-600 dark:text-neutral-400">
                      Archive: {category.factors.archiveAvailability}
                    </Text>
                    <Text className="mr-4 text-xs text-neutral-600 dark:text-neutral-400">
                      HD: {category.factors.qualityVariants}
                    </Text>
                  </View>

                  <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                    {category.recommendationReason.join(' • ')}
                  </Text>
                </View>

                <View className="ml-4 items-center">
                  <Text
                    className={`text-lg font-bold ${getScoreColor(category.totalScore)}`}
                  >
                    {category.totalScore}
                  </Text>
                  <Text className="text-xs text-neutral-500">/100</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
