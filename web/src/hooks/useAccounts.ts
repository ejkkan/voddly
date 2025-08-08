"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "~/lib/api-client";

export function useListAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.user.listAccounts(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string }) => apiClient.user.createAccount(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useListAccountSources(accountId?: string) {
  return useQuery({
    queryKey: ["accounts", accountId, "sources"],
    queryFn: () => apiClient.user.listAccountSources(accountId as string),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAccountSecret() {
  return useMutation({
    mutationFn: (body: {
      accountId: string;
      type: string;
      name?: string | null;
      ciphertext: string;
      nonce: string;
      wrapped_dek: string;
      wrapped_dek_nonce: string;
      cipher_algo: string;
      version?: number;
    }) => apiClient.user.createAccountSecret(body.accountId, body),
  });
}

export function useCreateAccountSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      accountId: string;
      provider_type: string;
      label: string;
      secret_id?: string | null;
      priority?: number;
    }) => apiClient.user.createAccountSource(body.accountId, body),
    onSuccess: (_, body) => {
      qc.invalidateQueries({ queryKey: ["accounts", body.accountId, "sources"] });
    },
  });
}

