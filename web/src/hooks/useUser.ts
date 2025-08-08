"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "~/lib/api-client";
import { useSession } from "./useAuth";

export function useCurrentUser() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["user", "current"],
    queryFn: async () => {
      console.log("🔍 Fetching current user...");
      try {
        const result = await apiClient.user.getCurrentUser();
        console.log("✅ Current user fetched:", result);
        return result;
      } catch (error) {
        console.error("❌ Error fetching current user:", error);
        throw error;
      }
    },
    enabled: !!session, // Only run if user is authenticated
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// Deprecated - use useUserAccounts and useAccountSources from useSource.ts instead
export function useUserPlaylists() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["user", "playlists"],
    queryFn: async () => {
      console.log("⚠️ useUserPlaylists is deprecated - returning empty");
      // Return empty to prevent errors during migration
      return { playlists: [] };
    },
    enabled: !!session,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      apiClient.user.updateCurrentUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}
