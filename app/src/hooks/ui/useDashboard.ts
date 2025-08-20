'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchDashboardPreviews } from '@/lib/db/ui';
import { useActiveAccountId } from './useAccounts';

export function useDashboardPreviews(limit = 10) {
  const { accountId } = useActiveAccountId();
  return useQuery({
    queryKey: ['ui', 'dashboard', limit, accountId ?? null],
    queryFn: async () => {
      try {
        return await fetchDashboardPreviews(limit, accountId);
      } catch {
        return await fetchDashboardPreviews(limit, undefined);
      }
    },
  });
}
