'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

type SubscriptionResponse = Awaited<
  ReturnType<typeof apiClient.user.getSubscription>
>;

// Centralized hook for subscription data - all other hooks should use this
export function useSubscriptionData() {
  return useQuery<SubscriptionResponse>({
    queryKey: ['subscription', 'data'],
    queryFn: () => apiClient.user.getSubscription(),
    // Accounts don't change often, so cache aggressively
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Hook for getting the active subscription ID
export function useActiveSubscriptionId(): {
  subscriptionId?: string;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useSubscriptionData();
  const subscriptionId = data?.subscription?.id ?? undefined;
  return { subscriptionId, isLoading, isError };
}

// Legacy hooks for backward compatibility
export function useActiveAccountId() {
  const { subscriptionId, ...rest } = useActiveSubscriptionId();
  return { accountId: subscriptionId, ...rest };
}

export function useAccounts() {
  const { data, ...rest } = useSubscriptionData();
  // Transform to match old format
  return {
    data: data?.subscription
      ? { accounts: [data.subscription] }
      : { accounts: [] },
    ...rest,
  };
}

export function useAccountsData() {
  return useAccounts();
}
