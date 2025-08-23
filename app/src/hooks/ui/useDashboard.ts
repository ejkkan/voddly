'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchDashboardPreviews } from '@/lib/db/ui';
import { useActiveAccountId } from './useAccounts';

export function useDashboardPreviews(limit = 10) {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  return useQuery({
    queryKey: ['ui', 'dashboard', limit, accountId ?? null],
    enabled: !accountsLoading,
    queryFn: () => fetchDashboardPreviews(limit, accountId || undefined),
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
}
