'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchDashboardPreviews, type UiCatalogItem } from '@/lib/db/ui';
import { createQueryOptions, queryKeys } from '@/lib/query-utils';

import { useActiveAccountId } from './useAccounts';

export interface DashboardItem {
  id: string;
  tmdbId?: string | null;
  title: string;
  imageUrl?: string | null;
  sourceId?: string;
}

export interface DashboardPreviewsResult {
  movies: DashboardItem[];
  series: DashboardItem[];
  live: DashboardItem[];
}

// Helper function to convert UiCatalogItem to DashboardItem
function mapUiCatalogToDashboard(item: UiCatalogItem): DashboardItem {
  return {
    id: item.id,
    tmdbId: item.tmdbId,
    title: item.title,
    imageUrl: item.imageUrl,
    sourceId: item.sourceId || undefined,
  };
}

export function useDashboardPreviews(limit = 10) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();

  return useQuery<DashboardPreviewsResult>({
    queryKey: queryKeys.dashboard.previews(limit, accountId ?? null),
    enabled: !accountsLoading,
    queryFn: async () => {
      const result = await fetchDashboardPreviews(
        limit,
        accountId || undefined
      );
      return {
        movies: result.movies.map(mapUiCatalogToDashboard),
        series: result.series.map(mapUiCatalogToDashboard),
        live: result.live.map(mapUiCatalogToDashboard),
      };
    },
    ...createQueryOptions('MEDIUM_LIVED'),
  });
}
