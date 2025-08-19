'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

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
    mutationFn: async (p: { email: string; password: string }) =>
      auth.signIn.email(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth'] });
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
  return useMutation({
    mutationFn: () => auth.signOut(),
    onSettled: () => {
      // Clear any cached auth state so guards react immediately
      qc.removeQueries({ queryKey: ['auth'] });
    },
  });
}
