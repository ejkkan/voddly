'use client';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { useXtreamClient } from './useXtream';

// Helper function to decode Base64 strings and fix encoding
function decodeBase64(str: string | undefined): string | undefined {
  if (!str) return undefined;
  try {
    // Check if string looks like Base64 (contains only valid Base64 chars)
    if (/^[A-Za-z0-9+/]+=*$/.test(str)) {
      const decoded = atob(str);

      // Fix double-encoded UTF-8 (Latin-1 interpreted as UTF-8)
      // This happens when the server encodes UTF-8 text as Latin-1 before Base64
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
      }

      // Decode as UTF-8
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const utf8Decoded = decoder.decode(bytes);

      // Check if the UTF-8 decode produced better results
      // If it has fewer "Ã" characters, it's likely the correct decoding
      const latin1Count = (decoded.match(/Ã/g) || []).length;
      const utf8Count = (utf8Decoded.match(/Ã/g) || []).length;

      return utf8Count < latin1Count ? utf8Decoded : decoded;
    }
    return str;
  } catch {
    // If decoding fails, return original string
    return str;
  }
}

// Cache EPG data for individual channels
export function useChannelEpg(
  sourceId: string | undefined,
  channelId: string | undefined
) {
  const { getClient } = useXtreamClient();

  return useQuery({
    queryKey: ['channel-epg', sourceId, channelId],
    queryFn: async () => {
      if (!sourceId || !channelId) return null;

      const client = await getClient(sourceId);
      const data = await client.getShortEpg(channelId, 200);

      if (data?.epg_listings) {
        const listings = Array.isArray(data.epg_listings)
          ? data.epg_listings
          : Object.values(data.epg_listings);

        return listings.map((p: any) => ({
          id: p.id || p.epg_id || `${channelId}_${p.start}`,
          title: decodeBase64(p.title || p.name) || 'No Title',
          description: decodeBase64(p.description || p.descr),
          start: p.start || new Date(p.start_timestamp * 1000).toISOString(),
          end:
            p.end || p.stop || new Date(p.stop_timestamp * 1000).toISOString(),
        }));
      }

      return [];
    },
    enabled: !!sourceId && !!channelId,
    staleTime: 30 * 60 * 1000, // Consider data fresh for 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // Keep in cache for 2 hours
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false,
  });
}

// Fetch EPG for multiple channels efficiently
export function useBatchedEpg(
  sourceId: string | undefined,
  channelIds: string[]
) {
  const { getClient } = useXtreamClient();
  const queryClient = useQueryClient();
  // Track which channels have been successfully fetched
  const fetchedChannelsRef = useRef<Set<string>>(new Set());

  // Only fetch channels we haven't fetched yet in this session
  const channelsToFetch = useMemo(() => {
    return channelIds.filter((id) => !fetchedChannelsRef.current.has(id));
  }, [channelIds]);

  // Use parallel queries for each channel
  const queries = useQueries({
    queries: channelsToFetch.map((channelId) => ({
      queryKey: ['channel-epg', sourceId, channelId],
      queryFn: async () => {
        if (!sourceId || !channelId) return { channelId, programs: [] };

        try {
          const client = await getClient(sourceId);
          const data = await client.getShortEpg(channelId, 200);

          // Mark as fetched
          fetchedChannelsRef.current.add(channelId);

          if (data?.epg_listings) {
            const listings = Array.isArray(data.epg_listings)
              ? data.epg_listings
              : Object.values(data.epg_listings);

            const programs = listings.map((p: any) => ({
              id: p.id || p.epg_id || `${channelId}_${p.start}`,
              title: decodeBase64(p.title || p.name) || 'No Title',
              description: decodeBase64(p.description || p.descr),
              start:
                p.start || new Date(p.start_timestamp * 1000).toISOString(),
              end:
                p.end ||
                p.stop ||
                new Date(p.stop_timestamp * 1000).toISOString(),
            }));

            return { channelId, programs };
          }

          return { channelId, programs: [] };
        } catch (error) {
          console.error(`Failed to fetch EPG for channel ${channelId}:`, error);
          return { channelId, programs: [] };
        }
      },
      enabled: !!sourceId && !!channelId,
      staleTime: 30 * 60 * 1000,
      cacheTime: 2 * 60 * 60 * 1000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    })),
  });

  // Combine all results including cached data for previously fetched channels
  const epgData = useMemo(() => {
    const result = new Map<string, any[]>();

    // Add data from current queries
    queries.forEach((query) => {
      if (query.data) {
        result.set(query.data.channelId, query.data.programs);
      }
    });

    // Also get cached data for previously fetched channels
    channelIds.forEach((channelId) => {
      if (!result.has(channelId) && fetchedChannelsRef.current.has(channelId)) {
        // This channel was fetched before, try to get from React Query cache
        const cachedData = queryClient.getQueryData([
          'channel-epg',
          sourceId,
          channelId,
        ]) as any;
        if (cachedData) {
          result.set(channelId, cachedData.programs || []);
        }
      }
    });

    return result;
  }, [queries, channelIds, sourceId, queryClient]);

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  return {
    epgData,
    isLoading,
    isError,
    fetchedCount: fetchedChannelsRef.current.size,
    totalCount: channelIds.length,
  };
}

// Simple virtualized EPG hook - renders cached items immediately, lazy-loads uncached items
export function useSimpleVirtualizedEpg(
  sourceId: string | undefined,
  allChannels: { id: string; sourceItemId?: string }[],
  visibleRange: { start: number; end: number }
) {
  const queryClient = useQueryClient();
  // Keep track of channels to fetch (only uncached ones in viewport)
  const channelsToFetchRef = useRef<Set<string>>(new Set());

  // Determine which channels need fetching (visible + uncached)
  const channelsToFetch = useMemo(() => {
    const toFetch: string[] = [];
    const visibleChannels = allChannels.slice(
      visibleRange.start,
      visibleRange.end
    );

    visibleChannels.forEach((channel) => {
      if (!channel.sourceItemId) return;

      // Check if data exists in cache
      const cacheKey = ['channel-epg', sourceId, channel.sourceItemId];
      const cachedData = queryClient.getQueryData(cacheKey);

      // Only fetch if not in cache
      if (!cachedData) {
        toFetch.push(channel.sourceItemId);
        channelsToFetchRef.current.add(channel.sourceItemId);
      }
    });

    return toFetch;
  }, [allChannels, visibleRange, sourceId, queryClient]);

  // Fetch EPG only for uncached visible channels
  const {
    epgData: newEpgData,
    isLoading,
    isError,
  } = useBatchedEpg(sourceId, channelsToFetch);

  // Collect ALL programs from cache (including previously fetched) and add placeholders
  const programs = useMemo(() => {
    const result: any[] = [];
    const now = new Date();

    // Process ALL channels - both cached and newly fetched
    allChannels.forEach((channel) => {
      if (!channel.sourceItemId) return;

      // First try to get from new fetch results
      let channelPrograms = newEpgData.get(channel.sourceItemId);

      // If not in new results, try to get from React Query cache
      if (!channelPrograms) {
        const cacheKey = ['channel-epg', sourceId, channel.sourceItemId];
        const cachedData = queryClient.getQueryData(cacheKey);
        if (cachedData) {
          // Transform cached data to match expected format
          channelPrograms = Array.isArray(cachedData)
            ? cachedData
            : (cachedData as any)?.programs || [];
        }
      }

      // Add programs if found
      if (channelPrograms && channelPrograms.length > 0) {
        // Sort programs by start time
        const sortedPrograms = [...channelPrograms].sort(
          (a: any, b: any) =>
            new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        const baseTime = new Date(now);
        baseTime.setHours(baseTime.getHours() - 1, 0, 0, 0);
        const endTime = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

        // Add filler before first program if needed
        if (sortedPrograms.length > 0) {
          const firstProgramStart = new Date(sortedPrograms[0].start);
          if (firstProgramStart > baseTime) {
            result.push({
              channelUuid: channel.id,
              id: `${channel.id}-filler-start`,
              title: '',
              description: '',
              since: baseTime.toISOString(),
              till: sortedPrograms[0].start,
            });
          }
        }

        // Add actual programs and fillers between them
        sortedPrograms.forEach((program: any, index: number) => {
          result.push({
            channelUuid: channel.id,
            id: program.id,
            title: program.title,
            description: program.description,
            since: program.start,
            till: program.end,
          });

          // Add filler between programs if there's a gap
          if (index < sortedPrograms.length - 1) {
            const currentEnd = new Date(program.end);
            const nextStart = new Date(sortedPrograms[index + 1].start);
            if (nextStart > currentEnd) {
              result.push({
                channelUuid: channel.id,
                id: `${channel.id}-filler-${index}`,
                title: '',
                description: '',
                since: program.end,
                till: sortedPrograms[index + 1].start,
              });
            }
          }
        });

        // Add filler after last program if needed
        const lastProgram = sortedPrograms[sortedPrograms.length - 1];
        const lastProgramEnd = new Date(lastProgram.end);
        if (lastProgramEnd < endTime) {
          result.push({
            channelUuid: channel.id,
            id: `${channel.id}-filler-end`,
            title: '',
            description: '',
            since: lastProgram.end,
            till: endTime.toISOString(),
          });
        }
      } else {
        // No EPG data - create single placeholder for entire time span
        const baseTime = new Date(now);
        baseTime.setHours(baseTime.getHours() - 1, 0, 0, 0);
        const endTime = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);

        result.push({
          channelUuid: channel.id,
          id: `${channel.id}-placeholder-full`,
          title: '',
          description: '',
          since: baseTime.toISOString(),
          till: endTime.toISOString(),
        });
      }
    });

    return result;
  }, [newEpgData, allChannels, sourceId, queryClient]);

  // Count total cached channels
  const cachedCount = useMemo(() => {
    let count = 0;
    allChannels.forEach((channel) => {
      if (!channel.sourceItemId) return;
      const cacheKey = ['channel-epg', sourceId, channel.sourceItemId];
      const cachedData = queryClient.getQueryData(cacheKey);
      if (cachedData) count++;
    });
    return count;
  }, [allChannels, sourceId, queryClient]);

  return {
    programs,
    isLoading,
    isError,
    fetchedCount: cachedCount,
    totalCount: allChannels.filter((ch) => ch.sourceItemId).length,
    refetch: () => {
      // Clear fetching tracker to force re-fetch
      channelsToFetchRef.current.clear();
    },
  };
}
