'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  backfillMissingItemCategories,
  fetchCategoriesWithPreviews,
  fetchCategoryItems,
  fetchPreviewByType,
  type CatalogItemType,
  type UiCatalogItem,
} from '@/lib/db/ui';
import { useActiveAccountId } from './useAccounts';

export function useUiSections(
  type: CatalogItemType,
  opts?: {
    limitPerCategory?: number;
    maxCategories?: number;
    categoryOffset?: number;
  }
) {
  const { accountId } = useActiveAccountId();
  const limitPerCategory = opts?.limitPerCategory ?? 10;
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
    queryFn: async () => {
      try {
        backfillMissingItemCategories().catch(() => {});
      } catch {}
      try {
        return await fetchCategoriesWithPreviews(
          type,
          limitPerCategory,
          maxCategories,
          categoryOffset,
          accountId
        );
      } catch {
        return await fetchCategoriesWithPreviews(
          type,
          limitPerCategory,
          maxCategories,
          categoryOffset,
          undefined
        );
      }
    },
  });
}

export function useUiPreview(type: CatalogItemType, limit = 10) {
  const { accountId } = useActiveAccountId();
  return useQuery({
    queryKey: ['ui', 'preview', type, limit, accountId ?? null],
    queryFn: async () => {
      try {
        return await fetchPreviewByType(type, limit, accountId);
      } catch {
        return await fetchPreviewByType(type, limit, undefined);
      }
    },
  });
}

export function useFetchMoreCategoryItems(
  type: CatalogItemType,
  categoryId: string,
  currentLength: number,
  pageSize = 25
) {
  const { accountId } = useActiveAccountId();
  return useQuery<UiCatalogItem[]>({
    enabled: Boolean(categoryId),
    queryKey: [
      'ui',
      'categoryItems',
      type,
      categoryId,
      currentLength,
      pageSize,
      accountId ?? null,
    ],
    queryFn: async () => {
      const more = await fetchCategoryItems(
        type,
        categoryId,
        pageSize,
        currentLength,
        accountId
      );
      return more ?? [];
    },
  });
}

export function buildUiRowLoader(
  type: CatalogItemType,
  setSections: (
    updater: (
      prev: {
        categoryId?: string;
        title: string;
        data: UiCatalogItem[];
        aspect?: 'poster' | 'backdrop';
      }[]
    ) => any
  ) => void
) {
  return async (categoryId?: string) => {
    if (!categoryId) return;
    const more = await fetchCategoryItems(type, categoryId, 25, 0);
    if (!more || more.length === 0) return;
    setSections((prev) => {
      const copy = prev.slice();
      const idx = copy.findIndex((s) => s.categoryId === categoryId);
      if (idx === -1) return prev;
      const target = copy[idx];
      copy[idx] = { ...target, data: target.data.concat(more) } as any;
      return copy;
    });
  };
}
