'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '@/lib/query-utils';

import type { DashboardItem } from './useDashboard';

// Hook for optimistic dashboard updates
export function useOptimisticDashboard() {
  const queryClient = useQueryClient();

  // Optimistically add a new item to the dashboard
  const addItemOptimistically = useCallback(
    (item: DashboardItem, type: 'movies' | 'series' | 'live') => {
      queryClient.setQueryData(
        queryKeys.dashboard.previews(),
        (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            [type]: [item, ...(oldData[type] || [])],
          };
        }
      );
    },
    [queryClient]
  );

  // Optimistically remove an item from the dashboard
  const removeItemOptimistically = useCallback(
    (itemId: string, type: 'movies' | 'series' | 'live') => {
      queryClient.setQueryData(
        queryKeys.dashboard.previews(),
        (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            [type]: (oldData[type] || []).filter(
              (item: DashboardItem) => item.id !== itemId
            ),
          };
        }
      );
    },
    [queryClient]
  );

  // Optimistically update an item in the dashboard
  const updateItemOptimistically = useCallback(
    (
      itemId: string,
      updates: Partial<DashboardItem>,
      type: 'movies' | 'series' | 'live'
    ) => {
      queryClient.setQueryData(
        queryKeys.dashboard.previews(),
        (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            [type]: (oldData[type] || []).map((item: DashboardItem) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          };
        }
      );
    },
    [queryClient]
  );

  // Optimistically reorder items in the dashboard
  const reorderItemsOptimistically = useCallback(
    (type: 'movies' | 'series' | 'live', newOrder: string[]) => {
      queryClient.setQueryData(
        queryKeys.dashboard.previews(),
        (oldData: any) => {
          if (!oldData) return oldData;

          const currentItems = oldData[type] || [];
          const itemMap = new Map(
            currentItems.map((item: DashboardItem) => [item.id, item])
          );

          const reorderedItems = newOrder
            .map((id) => itemMap.get(id))
            .filter(Boolean) as DashboardItem[];

          return {
            ...oldData,
            [type]: reorderedItems,
          };
        }
      );
    },
    [queryClient]
  );

  // Mutation for adding an item with optimistic updates
  const addItemMutation = useMutation({
    mutationFn: async ({
      item,
      type,
    }: {
      item: DashboardItem;
      type: 'movies' | 'series' | 'live';
    }) => {
      // Simulate API call - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, item };
    },
    onMutate: async ({ item, type }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.dashboard.previews(),
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(
        queryKeys.dashboard.previews()
      );

      // Optimistically update to the new value
      addItemOptimistically(item, type);

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.dashboard.previews(),
          context.previousData
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.previews(),
      });
    },
  });

  return {
    addItemOptimistically,
    removeItemOptimistically,
    updateItemOptimistically,
    reorderItemsOptimistically,
    addItemMutation,
  };
}
