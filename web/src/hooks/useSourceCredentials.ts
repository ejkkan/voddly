"use client";

import { useCallback } from "react";
import {
  SourceCredentials,
  SourceCredentialsManager,
  SourceCredentialsOptions,
  SourceInfo,
} from "~/lib/source-credentials";
import { usePassphrase } from "./usePassphrase";

/**
 * Hook for managing source credentials with automatic account resolution and passphrase caching
 */
export function useSourceCredentials() {
  const { getPassphrase } = usePassphrase();

  // Create manager instance with the passphrase hook
  const manager = new SourceCredentialsManager({ getPassphrase });

  /**
   * Get decrypted credentials for a source
   * Automatically handles account resolution and passphrase caching
   */
  const getCredentials = useCallback(
    async (
      sourceId: string,
      options?: SourceCredentialsOptions,
    ): Promise<SourceCredentials> => {
      return manager.getSourceCredentials(sourceId, options);
    },
    [manager],
  );

  /**
   * Get source info without decrypting credentials
   */
  const getSourceInfo = useCallback(
    async (sourceId: string): Promise<SourceInfo> => {
      return manager.getSourceInfo(sourceId);
    },
    [manager],
  );

  /**
   * Convenience method for playing content
   * Returns both credentials and constructs streaming URL
   */
  const prepareContentPlayback = useCallback(
    async (
      sourceId: string,
      contentId: number | string,
      contentType: "movie" | "series" | "live",
      options?: SourceCredentialsOptions,
    ) => {
      const credentials = await getCredentials(sourceId, {
        title: `Play ${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`,
        message: "Enter your passphrase to decrypt the source",
        ...options,
      });

      return {
        credentials,
        sourceId,
        contentId,
        contentType,
      };
    },
    [getCredentials],
  );

  return {
    getCredentials,
    getSourceInfo,
    prepareContentPlayback,
  };
}
