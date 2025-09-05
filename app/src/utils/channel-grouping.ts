/**
 * Utility functions for intelligent channel grouping by name similarity
 */

export interface ChannelItem {
  id: string;
  title: string;
  [key: string]: any;
}

/**
 * Normalize channel name for comparison by removing common variations
 */
function normalizeChannelName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Remove common quality indicators
      .replace(/\b(4k|uhd|hd|sd|fhd|full hd)\b/gi, '')
      // Remove common language indicators
      .replace(/\b(se|sv|en|no|dk|fi)\b/gi, '')
      // Remove numbers at the end (like "Sport 1", "Sport 2")
      .replace(/\s+\d+$/, '')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Extract base name from channel title for grouping
 * Examples:
 * - "Viaplay Sport" -> "viaplay sport"
 * - "Viaplay Sport 4K" -> "viaplay sport"
 * - "SVT1 HD" -> "svt"
 * - "TV4 Sport 1" -> "tv sport"
 */
function getChannelBaseName(name: string): string {
  const normalized = normalizeChannelName(name);

  // Handle common broadcaster patterns
  if (normalized.includes('viaplay')) {
    return normalized.replace(/viaplay\s*/, 'viaplay ').trim();
  }

  if (normalized.includes('svt')) {
    return 'svt';
  }

  if (normalized.includes('tv4') || normalized.includes('tv 4')) {
    return normalized.replace(/tv\s*4?\s*/, 'tv4 ').trim();
  }

  if (normalized.includes('c more') || normalized.includes('cmore')) {
    return normalized.replace(/c\s*more\s*/, 'cmore ').trim();
  }

  if (normalized.includes('discovery')) {
    return normalized.replace(/discovery\s*/, 'discovery ').trim();
  }

  if (normalized.includes('eurosport')) {
    return normalized.replace(/eurosport\s*/, 'eurosport ').trim();
  }

  return normalized;
}

/**
 * Calculate similarity score between two channel names (0-1, higher = more similar)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const base1 = getChannelBaseName(name1);
  const base2 = getChannelBaseName(name2);

  // Exact base name match
  if (base1 === base2) {
    return 1.0;
  }

  // Check if one is a subset of the other
  if (base1.includes(base2) || base2.includes(base1)) {
    return 0.8;
  }

  // Calculate Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(base1, base2);
  const maxLength = Math.max(base1.length, base2.length);

  if (maxLength === 0) return 0;

  const similarity = 1 - distance / maxLength;

  // Only consider it similar if similarity is above threshold
  return similarity >= 0.6 ? similarity : 0;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Group channels by name similarity
 * Returns channels sorted so that similar named channels appear together
 */
export function groupChannelsByName<T extends ChannelItem>(channels: T[]): T[] {
  if (channels.length <= 1) return channels;

  // Create groups based on base names
  const groups = new Map<string, T[]>();
  const ungrouped: T[] = [];

  for (const channel of channels) {
    const baseName = getChannelBaseName(channel.title);

    // Find if this channel belongs to any existing group
    let foundGroup = false;

    for (const [groupBaseName, groupChannels] of groups.entries()) {
      const similarity = calculateNameSimilarity(
        channel.title,
        groupChannels[0].title
      );

      if (similarity >= 0.6) {
        groupChannels.push(channel);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      // Check if we should create a new group or add to ungrouped
      const shouldGroup = channels.some((otherChannel) => {
        if (otherChannel.id === channel.id) return false;
        return (
          calculateNameSimilarity(channel.title, otherChannel.title) >= 0.6
        );
      });

      if (shouldGroup) {
        groups.set(baseName, [channel]);
      } else {
        ungrouped.push(channel);
      }
    }
  }

  // Sort channels within each group by quality/version (4K, HD, etc.)
  for (const groupChannels of groups.values()) {
    groupChannels.sort((a, b) => {
      const aHas4K = /4k|uhd/i.test(a.title);
      const bHas4K = /4k|uhd/i.test(b.title);
      const aHasHD = /hd|fhd/i.test(a.title);
      const bHasHD = /hd|fhd/i.test(b.title);

      // 4K first, then HD, then standard
      if (aHas4K && !bHas4K) return -1;
      if (!aHas4K && bHas4K) return 1;
      if (aHasHD && !bHasHD) return -1;
      if (!aHasHD && bHasHD) return 1;

      // If same quality level, sort alphabetically
      return a.title.localeCompare(b.title);
    });
  }

  // Combine all groups and ungrouped channels
  const result: T[] = [];

  // Add grouped channels (sorted by group name)
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [, groupChannels] of sortedGroups) {
    result.push(...groupChannels);
  }

  // Add ungrouped channels at the end, sorted alphabetically
  ungrouped.sort((a, b) => a.title.localeCompare(b.title));
  result.push(...ungrouped);

  return result;
}

/**
 * Sort channels with favorites first, then cluster similar channels together (without merging)
 */
export function sortChannelsWithClustering<T extends ChannelItem>(
  channels: T[],
  isFavorite: (id: string) => boolean
): T[] {
  // Separate favorites and non-favorites
  const favorites = channels.filter((channel) => isFavorite(channel.id));
  const nonFavorites = channels.filter((channel) => !isFavorite(channel.id));

  // Apply clustering to both favorites and non-favorites
  const clusteredFavorites = clusterChannelsByName(favorites);
  const clusteredNonFavorites = clusterChannelsByName(nonFavorites);

  return [...clusteredFavorites, ...clusteredNonFavorites];
}

/**
 * Cluster channels by name similarity without merging them
 * Returns all channels sorted so similar ones appear together
 */
export function clusterChannelsByName<T extends ChannelItem>(channels: T[]): T[] {
  if (channels.length <= 1) return channels;

  const processed = new Set<string>();
  const result: T[] = [];

  // For each channel, find all similar channels and add them as a cluster
  for (const channel of channels) {
    if (processed.has(channel.id)) continue;

    // Find all channels similar to this one (including itself)
    const cluster: T[] = [];
    const baseName = getChannelBaseName(channel.title);

    for (const otherChannel of channels) {
      if (processed.has(otherChannel.id)) continue;

      const similarity = calculateNameSimilarity(channel.title, otherChannel.title);
      
      if (similarity >= 0.6 || channel.id === otherChannel.id) {
        cluster.push(otherChannel);
        processed.add(otherChannel.id);
      }
    }

    // Sort channels within cluster by quality/version (4K, HD, etc.)
    cluster.sort((a, b) => {
      const aHas4K = /4k|uhd/i.test(a.title);
      const bHas4K = /4k|uhd/i.test(b.title);
      const aHasHD = /hd|fhd/i.test(a.title);
      const bHasHD = /hd|fhd/i.test(b.title);

      // 4K first, then HD, then standard
      if (aHas4K && !bHas4K) return -1;
      if (!aHas4K && bHas4K) return 1;
      if (aHasHD && !bHasHD) return -1;
      if (!aHasHD && bHasHD) return 1;

      // If same quality level, sort alphabetically
      return a.title.localeCompare(b.title);
    });

    result.push(...cluster);
  }

  return result;
}

/**
 * Sort channels with favorites first, then by name similarity groups
 * @deprecated Use sortChannelsWithClustering instead for better channel organization
 */
export function sortChannelsWithGrouping<T extends ChannelItem>(
  channels: T[],
  isFavorite: (id: string) => boolean
): T[] {
  // Separate favorites and non-favorites
  const favorites = channels.filter((channel) => isFavorite(channel.id));
  const nonFavorites = channels.filter((channel) => !isFavorite(channel.id));

  // Apply intelligent grouping to both favorites and non-favorites
  const groupedFavorites = groupChannelsByName(favorites);
  const groupedNonFavorites = groupChannelsByName(nonFavorites);

  return [...groupedFavorites, ...groupedNonFavorites];
}
