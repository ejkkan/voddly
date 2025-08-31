/* eslint-disable simple-import-sort/imports */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveAccountId } from './useAccounts';
import {
  fetchCategoriesWithPreviews,
  fetchCategoryItems,
  fetchPreviewByType,
  type CatalogItemType,
  type UiCatalogItem,
} from '@/lib/db/ui';

type SectionsTimingParams = {
  type: CatalogItemType;
  limitPerCategory: number;
  maxCategories: number;
  categoryOffset: number;
  accountId: string | null | undefined;
};

async function fetchUiSections(params: SectionsTimingParams) {
  const p = params;
  return await fetchCategoriesWithPreviews(
    p.type,
    p.limitPerCategory,
    p.maxCategories,
    p.categoryOffset,
    p.accountId || undefined
  );
}

/**
 * Hook to fetch UI sections with optional enabled flag
 *
 * @example
 * // Only fetch when on dashboard route
 * const { data, isLoading } = useUiSections('movie', {
 *   enabled: useIsDashboardRoute(),
 *   limitPerCategory: 20
 * });
 */
export function useUiSections(
  type: CatalogItemType,
  opts?: {
    limitPerCategory?: number;
    maxCategories?: number;
    categoryOffset?: number;
    enabled?: boolean;
  }
) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  const limitPerCategory = opts?.limitPerCategory ?? 20;
  const maxCategories = opts?.maxCategories ?? 10;
  const categoryOffset = opts?.categoryOffset ?? 0;
  const enabled = opts?.enabled ?? true;

  return useQuery({
    queryKey: [
      'ui',
      'sections',
      type,
      limitPerCategory,
      maxCategories,
      categoryOffset,
      accountId ?? null,
    ],
    enabled: enabled && !accountsLoading,
    queryFn: () =>
      fetchUiSections({
        type,
        limitPerCategory,
        maxCategories,
        categoryOffset,
        accountId,
      }),
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch UI preview with optional enabled flag
 *
 * @example
 * // Only fetch when on movies route
 * const { data, isLoading } = useUiPreview('movie', 10, useIsMoviesRoute());
 */
export function useUiPreview(
  type: CatalogItemType,
  limit = 10,
  enabled = true
) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  return useQuery({
    queryKey: ['ui', 'preview', type, limit, accountId ?? null],
    enabled: enabled && !accountsLoading,
    queryFn: async () =>
      fetchPreviewByType(type, limit, accountId || undefined),
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch more category items with optional enabled flag
 *
 * @example
 * // Only fetch when on series route
 * const { data, isLoading } = useFetchMoreCategoryItems(
 *   'series', categoryId, currentLength, 25, useIsSeriesRoute()
 * );
 */
// eslint-disable-next-line max-params
export function useFetchMoreCategoryItems(
  type: CatalogItemType,
  categoryId: string,
  currentLength: number,
  pageSize = 25,
  enabled = true
) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  return useQuery<UiCatalogItem[]>({
    enabled: enabled && Boolean(categoryId) && !accountsLoading,
    queryKey: [
      'ui',
      'categoryItems',
      type,
      categoryId,
      currentLength,
      pageSize,
      accountId ?? null,
    ],
    queryFn: async () =>
      fetchCategoryItems(
        type,
        categoryId,
        pageSize,
        currentLength,
        accountId || undefined
      ),
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });
}
