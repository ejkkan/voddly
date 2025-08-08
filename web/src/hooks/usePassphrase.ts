"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { passphraseCache } from "~/lib/passphrase-cache";

export interface PassphrasePromptOptions {
  title?: string;
  message?: string;
  accountName?: string;
  validateFn?: (passphrase: string) => Promise<boolean>;
}

export interface UsePassphraseReturn {
  /**
   * Get a passphrase for an account, using cache or prompting user
   */
  getPassphrase: (
    accountId: string,
    options?: PassphrasePromptOptions,
  ) => Promise<string>;

  /**
   * Check if a passphrase is cached for an account
   */
  hasCachedPassphrase: (accountId: string) => boolean;

  /**
   * Manually cache a passphrase for an account
   */
  cachePassphrase: (accountId: string, passphrase: string) => void;

  /**
   * Remove a cached passphrase for an account
   */
  removeCachedPassphrase: (accountId: string) => void;

  /**
   * Clear all cached passphrases
   */
  clearAllCachedPassphrases: () => void;

  /**
   * Get time remaining until cache expires for an account (in seconds)
   */
  getCacheTimeRemaining: (accountId: string) => number;

  /**
   * Get all account IDs with cached passphrases
   */
  getCachedAccountIds: () => string[];
}

/**
 * Hook for managing passphrase caching and prompting
 */
export function usePassphrase(): UsePassphraseReturn {
  const [, forceUpdate] = useState(0);

  // Force re-render when cache changes
  const triggerUpdate = useCallback(() => {
    forceUpdate((prev) => prev + 1);
  }, []);

  // Set up periodic updates to refresh UI when cache expires
  useEffect(() => {
    const interval = setInterval(() => {
      triggerUpdate();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [triggerUpdate]);

  const getPassphrase = useCallback(
    async (accountId: string, options: PassphrasePromptOptions = {}): Promise<string> => {
      // First, try to get from cache
      const cached = passphraseCache.get(accountId);
      if (cached) {
        return cached;
      }

      // If not cached, prompt user
      const {
        title = "Passphrase Required",
        message = "Enter your passphrase to decrypt the account",
        accountName,
        validateFn,
      } = options;

      let promptMessage = message;
      if (accountName) {
        promptMessage = `${message} for account "${accountName}"`;
      }

      const passphrase = window.prompt(`${title}\n\n${promptMessage}:`);

      if (!passphrase) {
        throw new Error("Passphrase is required");
      }

      if (passphrase.length < 6) {
        toast.error("Passphrase must be at least 6 characters");
        throw new Error("Passphrase must be at least 6 characters");
      }

      // Validate passphrase if validation function provided
      if (validateFn) {
        try {
          const isValid = await validateFn(passphrase);
          if (!isValid) {
            toast.error("Invalid passphrase");
            throw new Error("Invalid passphrase");
          }
        } catch (error) {
          toast.error("Failed to validate passphrase");
          throw error;
        }
      }

      // Cache the validated passphrase
      passphraseCache.set(accountId, passphrase);
      triggerUpdate();

      toast.success("Passphrase cached for 5 minutes", {
        description: "You won't be prompted again until the cache expires",
      });

      return passphrase;
    },
    [triggerUpdate],
  );

  const hasCachedPassphrase = useCallback((accountId: string): boolean => {
    return passphraseCache.has(accountId);
  }, []);

  const cachePassphrase = useCallback(
    (accountId: string, passphrase: string): void => {
      if (passphrase.length < 6) {
        throw new Error("Passphrase must be at least 6 characters");
      }
      passphraseCache.set(accountId, passphrase);
      triggerUpdate();
    },
    [triggerUpdate],
  );

  const removeCachedPassphrase = useCallback(
    (accountId: string): void => {
      passphraseCache.remove(accountId);
      triggerUpdate();
    },
    [triggerUpdate],
  );

  const clearAllCachedPassphrases = useCallback((): void => {
    passphraseCache.clear();
    triggerUpdate();
    toast.info("All cached passphrases cleared");
  }, [triggerUpdate]);

  const getCacheTimeRemaining = useCallback((accountId: string): number => {
    return Math.ceil(passphraseCache.getTimeRemaining(accountId) / 1000);
  }, []);

  const getCachedAccountIds = useCallback((): string[] => {
    return passphraseCache.getCachedAccountIds();
  }, []);

  return {
    getPassphrase,
    hasCachedPassphrase,
    cachePassphrase,
    removeCachedPassphrase,
    clearAllCachedPassphrases,
    getCacheTimeRemaining,
    getCachedAccountIds,
  };
}

/**
 * Hook for getting a passphrase for a specific account with automatic validation
 */
export function useAccountPassphrase(
  accountId: string,
  keyData?: {
    wrapped_master_key: string;
    salt: string;
    iv: string;
  },
  accountName?: string,
) {
  const { getPassphrase, hasCachedPassphrase, getCacheTimeRemaining } = usePassphrase();

  const getValidatedPassphrase = useCallback(async (): Promise<string> => {
    if (!keyData) {
      throw new Error("Key data required for validation");
    }

    return getPassphrase(accountId, {
      title: "Account Passphrase Required",
      message: "Enter your passphrase to decrypt",
      accountName,
      validateFn: async (passphrase: string) => {
        // Basic validation - could be enhanced with actual key derivation test
        return passphrase.length >= 6;
      },
    });
  }, [accountId, accountName, keyData, getPassphrase]);

  return {
    getValidatedPassphrase,
    hasCachedPassphrase: () => hasCachedPassphrase(accountId),
    getCacheTimeRemaining: () => getCacheTimeRemaining(accountId),
  };
}
