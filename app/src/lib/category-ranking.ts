/**
 * Category Ranking and Highlighting System
 *
 * This module provides utilities to rank and prioritize IPTV categories
 * based on various factors like content quality, geographic relevance,
 * and user engagement patterns.
 */

export interface CategoryRankingFactors {
  channelCount: number;
  epgAvailability: number;
  archiveAvailability: number;
  qualityVariants: number;
  familyFriendlyRatio: number;
  geographicRelevance: number;
  contentTypeScore: number;
  premiumContentRatio: number;
}

export interface RankedCategory {
  categoryId: string;
  name: string;
  totalScore: number;
  factors: CategoryRankingFactors;
  highlightLevel: 'high' | 'medium' | 'low';
  recommendationReason: string[];
}

export interface LiveStream {
  stream_id: number;
  name: string;
  stream_type: string;
  stream_icon?: string;
  epg_channel_id?: string;
  is_adult: number;
  tv_archive: number;
  tv_archive_duration?: string;
  category_id: string;
  category_ids?: number[];
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

/**
 * Geographic priority mapping for different regions
 */
const GEOGRAPHIC_PRIORITIES = {
  // Primary markets (highest priority)
  primary: {
    keywords: ['Sweden', 'SE', 'Svenska', 'Svensk'],
    score: 100,
  },
  // Nordic countries (high priority)
  nordic: {
    keywords: [
      'Denmark',
      'DK',
      'Norge',
      'Norway',
      'NO',
      'Finland',
      'FI',
      'Iceland',
      'IS',
      'Nordic',
    ],
    score: 80,
  },
  // European (medium priority)
  european: {
    keywords: ['Germany', 'DE', 'France', 'FR', 'UK', 'Netherlands', 'NL'],
    score: 60,
  },
  // International/Generic (lower priority)
  international: {
    keywords: ['World', 'International', '24/7', 'Global'],
    score: 40,
  },
};

/**
 * Content type scoring based on typical user engagement
 */
const CONTENT_TYPE_SCORES = {
  // National broadcast channels (highest engagement)
  national: {
    patterns: [/^SVT/i, /^TV[0-9]/i, /^Kanal [0-9]/i, /^Sjuan/i],
    score: 100,
    reason: 'National broadcast channel',
  },
  // Sports content (high engagement)
  sports: {
    patterns: [
      /Sport/i,
      /Allsvenskan/i,
      /Hockey/i,
      /Football/i,
      /DAZN/i,
      /Premier League/i,
      /Champions League/i,
      /Bundesliga/i,
      /Elitserien/i,
    ],
    score: 90,
    reason: 'Sports content',
  },
  // Premium streaming services
  premium: {
    patterns: [/Max/i, /Disney/i, /Discovery/i, /Viaplay/i, /Prime/i],
    score: 85,
    reason: 'Premium streaming service',
  },
  // News and information
  news: {
    patterns: [/News/i, /Info/i, /24/i, /Nyheter/i],
    score: 75,
    reason: 'News and information',
  },
  // Entertainment
  entertainment: {
    patterns: [/Film/i, /Movie/i, /Serie/i, /Drama/i, /Comedy/i],
    score: 70,
    reason: 'Entertainment content',
  },
  // Specialty/Events
  specialty: {
    patterns: [/Events/i, /PPV/i, /Play/i, /Live/i],
    score: 60,
    reason: 'Specialty content',
  },
};

/**
 * Calculate geographic relevance score for a category
 */
function calculateGeographicScore(categoryName: string): number {
  const name = categoryName.toLowerCase();

  for (const [level, config] of Object.entries(GEOGRAPHIC_PRIORITIES)) {
    for (const keyword of config.keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return config.score;
      }
    }
  }

  return 20; // Default score for unmatched categories
}

/**
 * Calculate content type score and identify the reason
 */
function calculateContentTypeScore(categoryName: string): {
  score: number;
  reason: string;
} {
  for (const [type, config] of Object.entries(CONTENT_TYPE_SCORES)) {
    for (const pattern of config.patterns) {
      if (pattern.test(categoryName)) {
        return { score: config.score, reason: config.reason };
      }
    }
  }

  return { score: 30, reason: 'General content' };
}

/**
 * Analyze streams within a category to calculate quality metrics
 */
function analyzeStreams(streams: LiveStream[]): {
  epgAvailability: number;
  archiveAvailability: number;
  qualityVariants: number;
  familyFriendlyRatio: number;
  premiumContentRatio: number;
} {
  if (streams.length === 0) {
    return {
      epgAvailability: 0,
      archiveAvailability: 0,
      qualityVariants: 0,
      familyFriendlyRatio: 0,
      premiumContentRatio: 0,
    };
  }

  const epgCount = streams.filter(
    (s) => s.epg_channel_id && s.epg_channel_id !== ''
  ).length;
  const archiveCount = streams.filter((s) => s.tv_archive === 1).length;
  const qualityCount = streams.filter(
    (s) =>
      s.name.includes('HD') ||
      s.name.includes('FHD') ||
      s.name.includes('4K') ||
      s.name.includes('UHD')
  ).length;
  const familyFriendlyCount = streams.filter((s) => s.is_adult === 0).length;
  const premiumCount = streams.filter((s) =>
    /premium|plus|max|viaplay|disney/i.test(s.name)
  ).length;

  return {
    epgAvailability: epgCount,
    archiveAvailability: archiveCount,
    qualityVariants: qualityCount,
    familyFriendlyRatio: familyFriendlyCount / streams.length,
    premiumContentRatio: premiumCount / streams.length,
  };
}

/**
 * Calculate comprehensive ranking score for a category
 */
export function rankCategory(
  category: Category,
  streams: LiveStream[] = []
): RankedCategory {
  const channelCount = streams.length;
  const streamAnalysis = analyzeStreams(streams);
  const geographicScore = calculateGeographicScore(category.category_name);
  const contentTypeResult = calculateContentTypeScore(category.category_name);

  // Calculate weighted total score
  const factors: CategoryRankingFactors = {
    channelCount,
    epgAvailability: streamAnalysis.epgAvailability,
    archiveAvailability: streamAnalysis.archiveAvailability,
    qualityVariants: streamAnalysis.qualityVariants,
    familyFriendlyRatio: streamAnalysis.familyFriendlyRatio,
    geographicRelevance: geographicScore,
    contentTypeScore: contentTypeResult.score,
    premiumContentRatio: streamAnalysis.premiumContentRatio,
  };

  // Weighted scoring algorithm
  const totalScore =
    // Channel count (20% weight, normalized to 0-100)
    Math.min(channelCount * 2, 100) * 0.2 +
    // EPG availability (15% weight)
    (streamAnalysis.epgAvailability / Math.max(channelCount, 1)) * 100 * 0.15 +
    // Archive availability (10% weight)
    (streamAnalysis.archiveAvailability / Math.max(channelCount, 1)) *
      100 *
      0.1 +
    // Quality variants (10% weight)
    (streamAnalysis.qualityVariants / Math.max(channelCount, 1)) * 100 * 0.1 +
    // Family friendly ratio (5% weight)
    streamAnalysis.familyFriendlyRatio * 100 * 0.05 +
    // Geographic relevance (25% weight)
    geographicScore * 0.25 +
    // Content type score (15% weight)
    contentTypeResult.score * 0.15;

  // Determine highlight level
  let highlightLevel: 'high' | 'medium' | 'low';
  if (totalScore >= 80) {
    highlightLevel = 'high';
  } else if (totalScore >= 60) {
    highlightLevel = 'medium';
  } else {
    highlightLevel = 'low';
  }

  // Generate recommendation reasons
  const recommendationReason: string[] = [];

  if (geographicScore >= 80) {
    recommendationReason.push('Local/Regional content');
  }

  if (contentTypeResult.score >= 85) {
    recommendationReason.push(contentTypeResult.reason);
  }

  if (streamAnalysis.epgAvailability / Math.max(channelCount, 1) > 0.7) {
    recommendationReason.push('Rich EPG data');
  }

  if (streamAnalysis.archiveAvailability > 0) {
    recommendationReason.push('TV Archive available');
  }

  if (streamAnalysis.qualityVariants / Math.max(channelCount, 1) > 0.5) {
    recommendationReason.push('HD/4K quality options');
  }

  if (channelCount >= 20) {
    recommendationReason.push('Large channel selection');
  }

  if (recommendationReason.length === 0) {
    recommendationReason.push('Standard content');
  }

  return {
    categoryId: category.category_id,
    name: category.category_name,
    totalScore: Math.round(totalScore),
    factors,
    highlightLevel,
    recommendationReason,
  };
}

/**
 * Rank multiple categories and sort by score
 */
export function rankCategories(
  categories: Category[],
  streamsByCategory: Map<string, LiveStream[]> = new Map()
): RankedCategory[] {
  return categories
    .map((category) => {
      const streams = streamsByCategory.get(category.category_id) || [];
      return rankCategory(category, streams);
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Get categories that should be highlighted in the UI
 */
export function getHighlightedCategories(
  rankedCategories: RankedCategory[],
  maxHighlighted: number = 5
): RankedCategory[] {
  return rankedCategories
    .filter((cat) => cat.highlightLevel === 'high')
    .slice(0, maxHighlighted);
}

/**
 * Get category recommendations based on user preferences
 */
export function getCategoryRecommendations(
  rankedCategories: RankedCategory[],
  userPreferences: {
    preferSports?: boolean;
    preferLocal?: boolean;
    preferPremium?: boolean;
    preferNews?: boolean;
  } = {}
): RankedCategory[] {
  return rankedCategories
    .filter((cat) => {
      if (
        userPreferences.preferSports &&
        cat.recommendationReason.includes('Sports content')
      ) {
        return true;
      }
      if (
        userPreferences.preferLocal &&
        cat.recommendationReason.includes('Local/Regional content')
      ) {
        return true;
      }
      if (
        userPreferences.preferPremium &&
        cat.recommendationReason.includes('Premium streaming service')
      ) {
        return true;
      }
      if (
        userPreferences.preferNews &&
        cat.recommendationReason.includes('News and information')
      ) {
        return true;
      }
      return cat.highlightLevel === 'high';
    })
    .slice(0, 10);
}

/**
 * Example usage with your sample data
 */
export function exampleUsage() {
  const sampleCategories: Category[] = [
    { category_id: '4', category_name: 'Sweden' },
    { category_id: '705', category_name: 'Allsvenskan & Superettan SE' },
    { category_id: '621', category_name: 'Max Sports SE' },
    { category_id: '480', category_name: 'Viaplay Sport SE' },
    { category_id: '532', category_name: '24/7 Swedish' },
    { category_id: '7', category_name: 'Denmark' },
    { category_id: '9', category_name: 'Norway' },
  ];

  const rankedCategories = rankCategories(sampleCategories);
  const highlighted = getHighlightedCategories(rankedCategories);

  console.log('Top highlighted categories:', highlighted);

  return { rankedCategories, highlighted };
}
