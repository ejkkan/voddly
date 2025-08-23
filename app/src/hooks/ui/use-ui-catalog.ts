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

export function useUiSections(
  type: CatalogItemType,
  opts?: {
    limitPerCategory?: number;
    maxCategories?: number;
    categoryOffset?: number;
  }
) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  const limitPerCategory = opts?.limitPerCategory ?? 20;
  const maxCategories = opts?.maxCategories ?? 10;
  const categoryOffset = opts?.categoryOffset ?? 0;

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
    enabled: !accountsLoading,
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

export function useUiPreview(type: CatalogItemType, limit = 10) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  return useQuery({
    queryKey: ['ui', 'preview', type, limit, accountId ?? null],
    enabled: !accountsLoading,
    queryFn: async () =>
      fetchPreviewByType(type, limit, accountId || undefined),
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
  });
}

// eslint-disable-next-line max-params
export function useFetchMoreCategoryItems(
  type: CatalogItemType,
  categoryId: string,
  currentLength: number,
  pageSize = 25
) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  return useQuery<UiCatalogItem[]>({
    enabled: Boolean(categoryId) && !accountsLoading,
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
