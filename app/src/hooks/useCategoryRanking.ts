/**
 * React hook for category ranking and highlighting
 */

import { useMemo } from 'react';
import {
  rankCategories,
  getHighlightedCategories,
  getCategoryRecommendations,
  type RankedCategory,
  type Category,
  type LiveStream,
} from '../lib/category-ranking';

export interface CategorySection {
  categoryId: string;
  title: string;
  items: {
    id: string;
    title: string;
    imageUrl?: string;
    sourceId?: string;
    sourceItemId?: string;
  }[];
}

/**
 * Hook to rank and highlight categories based on content analysis
 */
export function useCategoryRanking(
  categories: CategorySection[],
  userPreferences: {
    preferSports?: boolean;
    preferLocal?: boolean;
    preferPremium?: boolean;
    preferNews?: boolean;
  } = {}
) {
  const rankedCategories = useMemo(() => {
    if (!categories || categories.length === 0) {
      return [];
    }

    // Convert CategorySection to Category format for ranking
    const categoryData: Category[] = categories.map((cat) => ({
      category_id: cat.categoryId,
      category_name: cat.title,
    }));

    // For now, we'll rank based on category names and channel counts
    // In a full implementation, you'd fetch actual stream data
    const streamsByCategory = new Map<string, LiveStream[]>();

    categories.forEach((cat) => {
      // Mock stream data based on channel count and category name
      const mockStreams: LiveStream[] = cat.items.map((item, index) => ({
        stream_id: parseInt(item.sourceItemId || '0') || index,
        name: item.title,
        stream_type: 'live',
        stream_icon: item.imageUrl,
        epg_channel_id:
          item.title.includes('SVT') || item.title.includes('TV')
            ? `${item.title.toLowerCase().replace(/\s+/g, '')}.se`
            : '',
        is_adult: 0,
        tv_archive:
          item.title.includes('SVT') || item.title.includes('TV') ? 1 : 0,
        category_id: cat.categoryId,
        tv_archive_duration: '3',
      }));

      streamsByCategory.set(cat.categoryId, mockStreams);
    });

    return rankCategories(categoryData, streamsByCategory);
  }, [categories]);

  const highlightedCategories = useMemo(() => {
    return getHighlightedCategories(rankedCategories, 5);
  }, [rankedCategories]);

  const recommendedCategories = useMemo(() => {
    return getCategoryRecommendations(rankedCategories, userPreferences);
  }, [rankedCategories, userPreferences]);

  const getCategoryRank = (categoryId: string): RankedCategory | undefined => {
    return rankedCategories.find((cat) => cat.categoryId === categoryId);
  };

  const isCategoryHighlighted = (categoryId: string): boolean => {
    return highlightedCategories.some((cat) => cat.categoryId === categoryId);
  };

  const getCategoryHighlightLevel = (
    categoryId: string
  ): 'high' | 'medium' | 'low' | null => {
    const rank = getCategoryRank(categoryId);
    return rank?.highlightLevel || null;
  };

  const getCategoryScore = (categoryId: string): number => {
    const rank = getCategoryRank(categoryId);
    return rank?.totalScore || 0;
  };

  const getCategoryReasons = (categoryId: string): string[] => {
    const rank = getCategoryRank(categoryId);
    return rank?.recommendationReason || [];
  };

  // Sort original categories by ranking score
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const scoreA = getCategoryScore(a.categoryId);
      const scoreB = getCategoryScore(b.categoryId);
      return scoreB - scoreA;
    });
  }, [categories, rankedCategories]);

  return {
    rankedCategories,
    highlightedCategories,
    recommendedCategories,
    sortedCategories,
    getCategoryRank,
    isCategoryHighlighted,
    getCategoryHighlightLevel,
    getCategoryScore,
    getCategoryReasons,
  };
}

/**
 * Hook specifically for live TV category ranking
 */
export function useLiveTVCategoryRanking(
  categories: CategorySection[],
  userPreferences = {}
) {
  const ranking = useCategoryRanking(categories, {
    preferLocal: true, // Default to preferring local content for live TV
    ...userPreferences,
  });

  // Additional live TV specific logic
  const topNationalCategories = useMemo(() => {
    return ranking.rankedCategories
      .filter(
        (cat) =>
          cat.recommendationReason.includes('Local/Regional content') ||
          cat.recommendationReason.includes('National broadcast channel')
      )
      .slice(0, 3);
  }, [ranking.rankedCategories]);

  const topSportsCategories = useMemo(() => {
    return ranking.rankedCategories
      .filter((cat) => cat.recommendationReason.includes('Sports content'))
      .slice(0, 5);
  }, [ranking.rankedCategories]);

  return {
    ...ranking,
    topNationalCategories,
    topSportsCategories,
  };
}

/**
 * Get CSS classes for category highlighting
 */
export function getCategoryHighlightClasses(
  highlightLevel: 'high' | 'medium' | 'low' | null
): string {
  switch (highlightLevel) {
    case 'high':
    case 'medium':
    case 'low':
    default:
      return '';
  }
}

/**
 * Get highlight badge component props
 */
export function getCategoryBadgeProps(
  highlightLevel: 'high' | 'medium' | 'low' | null,
  reasons: string[]
): { color: string; text: string; tooltip: string } | null {
  if (!highlightLevel || highlightLevel === 'low') {
    return null;
  }

  const tooltip = reasons.join(' • ');

  switch (highlightLevel) {
    case 'high':
      return {
        color:
          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        text: '⭐ Recommended',
        tooltip,
      };
    case 'medium':
      return {
        color:
          'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
        text: 'Popular',
        tooltip,
      };
    default:
      return null;
  }
}
