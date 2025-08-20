'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

type AccountsResponse = Awaited<ReturnType<typeof apiClient.user.getAccounts>>;

export function useAccounts() {
  return useQuery<AccountsResponse>({
    queryKey: ['accounts', 'list'],
    queryFn: () => apiClient.user.getAccounts(),
    staleTime: 60_000,
  });
}

export function useActiveAccountId(): {
  accountId?: string;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useAccounts();
  const accountId =
    (data?.accounts?.[0]?.id as string | undefined) ?? undefined;
  return { accountId, isLoading, isError };
}
