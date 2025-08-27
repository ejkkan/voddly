'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { clearAccountCompletely } from '@/lib/db/management';

import auth from './auth-client';

export function useSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    // Standardize on Encore's /user/me as the session source of truth
    queryFn: async () => {
      const user = await apiClient.user.getCurrentUser();
      return { data: { user } } as any;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { email: string; password: string }) => {
      // Clear ALL local data before signing in to prevent data leakage
      try {
        console.log(
          '[SIGNIN] 🔒 Clearing all local data for account isolation'
        );
        const { clearAllData } = await import('@/lib/db/management');
        await clearAllData();
        console.log('[SIGNIN] ✅ All local data cleared successfully');
      } catch (error) {
        console.warn('[SIGNIN] Failed to clear local data:', error);
        // Continue with sign-in even if cleanup fails
      }

      return auth.signIn.email(p);
    },
    onSuccess: () => {
      // Clear all cached data to ensure clean state
      qc.clear();
      qc.invalidateQueries({ queryKey: ['auth'] });
      console.log('[SIGNIN] ✅ All cached data cleared for new user');
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { email: string; password: string; name?: string }) =>
      auth.signUp.email(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async () => {
      // Get the account ID BEFORE signing out (since signOut invalidates credentials)
      let accountId: string | undefined;
      if (session?.data?.user?.id) {
        try {
          console.log(
            '[LOGOUT] Starting database cleanup for user:',
            session.data.user.id
          );

          // Get the account ID for this user first
          const accounts = await apiClient.user.getAccounts();
          console.log('[LOGOUT] Found accounts:', accounts);

          accountId = accounts.accounts?.[0]?.id;
          console.log('[LOGOUT] Using account ID:', accountId);
        } catch (error) {
          console.error(
            '[LOGOUT] Failed to get account ID before logout:',
            error
          );
          // Continue with logout even if we can't get account ID
        }
      } else {
        console.warn(
          '[LOGOUT] No session user ID found, skipping database cleanup'
        );
      }

      // Now sign out (this invalidates credentials)
      const result = await auth.signOut();

      // Clear local database data for the current user's account
      if (accountId) {
        try {
          console.log(
            '[LOGOUT] Calling clearAccountCompletely with account ID:',
            accountId
          );
          await clearAccountCompletely(accountId);
          console.log('[LOGOUT] Database cleanup completed successfully');
        } catch (error) {
          console.error(
            '[LOGOUT] Failed to clear local database on logout:',
            error
          );
          // Don't throw - we still want to complete the logout even if cleanup fails
        }
      } else {
        console.warn('[LOGOUT] No account ID found, skipping database cleanup');
      }

      // Additional security: Clear ALL data to prevent any leakage
      try {
        console.log('[LOGOUT] 🔒 Additional security: clearing all data');
        const { clearAllData } = await import('@/lib/db/management');
        await clearAllData();
        console.log('[LOGOUT] ✅ All data cleared for security');
      } catch (error) {
        console.warn('[LOGOUT] Failed to clear all data:', error);
        // Continue with logout even if cleanup fails
      }

      return result;
    },
    onSettled: () => {
      // Clear any cached auth state so guards react immediately
      qc.removeQueries({ queryKey: ['auth'] });

      // Clear all cached data from React Query
      qc.clear();

      console.log('[LOGOUT] All React Query cache cleared');
    },
  });
}
