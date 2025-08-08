"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import authClient from "~/lib/auth/auth-client";
// Future: on successful login, derive KEK and upsert account key wrap as needed.

export function useSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => authClient.getSession(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return authClient.signIn.email({ email, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
