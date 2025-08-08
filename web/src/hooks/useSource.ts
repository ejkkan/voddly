"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "~/lib/api-client";

interface CreateSourceData {
  accountName: string;
  sourceName: string;
  providerType: string;
  credentials: {
    server: string;
    username: string;
    password: string;
  };
  passphrase: string;
}

interface AddSourceData {
  accountId: string;
  name: string;
  providerType: string;
  encryptedConfig: string;
  configIv: string;
}

export function useCreateSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSourceData) => {
      try {
        const result = await apiClient.user.createAccount({
          accountName: data.accountName,
          sourceName: data.sourceName,
          providerType: data.providerType,
          credentials: data.credentials,
          passphrase: data.passphrase,
        });
        return result;
      } catch (error) {
        console.error("Failed to create account:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to create source",
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Source created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create source");
    },
  });
}

export function useAddSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddSourceData) => {
      const response = await fetch("/api/sources", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to add source");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sources", variables.accountId] });
      toast.success("Source added successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add source");
    },
  });
}

export function useUserAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      try {
        const result = await apiClient.listAccounts();
        return result;
      } catch (error) {
        console.error("Failed to fetch accounts:", error);
        throw new Error("Failed to fetch accounts");
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAccountSources(accountId: string | undefined) {
  return useQuery({
    queryKey: ["sources", accountId],
    queryFn: async () => {
      if (!accountId) throw new Error("Account ID required");

      try {
        const result = await apiClient.listAccountSources(accountId);
        return result;
      } catch (error) {
        console.error("Failed to fetch sources:", error);
        throw new Error("Failed to fetch sources");
      }
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete source");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Source deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete source");
    },
  });
}
