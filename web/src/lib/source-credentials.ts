import { toast } from "sonner";
import { apiClient } from "./api-client";
import { AccountEncryption } from "./encryption";

export interface SourceCredentials {
  server: string;
  username: string;
  password: string;
  containerExtension?: string;
  videoCodec?: string;
  audioCodec?: string;
}

export interface SourceInfo {
  source: {
    id: string;
    name: string;
    encrypted_config: string;
    config_iv: string;
  };
  keyData: {
    wrapped_master_key: string;
    salt: string;
    iv: string;
  };
  account: {
    id: string;
    name: string;
  };
}

export interface SourceCredentialsOptions {
  title?: string;
  message?: string;
  validatePassphrase?: (passphrase: string) => Promise<boolean>;
}

/**
 * Centralized source credentials manager
 * Handles account resolution, passphrase caching, and credential decryption
 */
export class SourceCredentialsManager {
  private passphraseHook: {
    getPassphrase: (accountId: string, options?: any) => Promise<string>;
  };

  constructor(passphraseHook: {
    getPassphrase: (accountId: string, options?: any) => Promise<string>;
  }) {
    this.passphraseHook = passphraseHook;
  }

  /**
   * Find which account contains a specific source
   */
  async findSourceInfo(sourceId: string): Promise<SourceInfo> {
    const accountsData = await apiClient.user.getAccounts();

    // Find the account that contains this source
    for (const account of accountsData.accounts) {
      try {
        const { sources, keyData } = await apiClient.user.getSources(account.id);
        const source = sources?.find((s) => s.id === String(sourceId));

        if (source && keyData) {
          return {
            source: {
              id: source.id,
              name: source.name,
              encrypted_config: source.encrypted_config,
              config_iv: source.config_iv,
            },
            keyData,
            account: {
              id: account.id,
              name: account.name,
            },
          };
        }
      } catch (e) {
        // Continue searching other accounts
        continue;
      }
    }

    throw new Error("Source not found in any account");
  }

  /**
   * Get decrypted credentials for a source
   * Handles passphrase caching and account resolution automatically
   */
  async getSourceCredentials(
    sourceId: string,
    options: SourceCredentialsOptions = {},
  ): Promise<SourceCredentials> {
    try {
      // Find the source and account info
      const sourceInfo = await this.findSourceInfo(sourceId);

      // Get passphrase using the hook (will use cache or prompt)
      const passphrase = await this.passphraseHook.getPassphrase(sourceInfo.account.id, {
        title: options.title || "Decrypt Source",
        message: options.message || "Enter your passphrase to decrypt the source",
        accountName: sourceInfo.account.name,
        validateFn: options.validatePassphrase,
      });

      // Initialize encryption and decrypt
      const encryption = new AccountEncryption();
      await encryption.initialize(passphrase, sourceInfo.account.id);

      const masterKey = await encryption.getMasterKey(sourceInfo.keyData, passphrase);
      const credentials = await encryption.decryptSource(
        {
          encrypted_config: sourceInfo.source.encrypted_config,
          config_iv: sourceInfo.source.config_iv,
        },
        masterKey,
      );

      return credentials;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get source credentials";
      toast.error(message);
      throw error;
    }
  }

  /**
   * Get source info without decrypting credentials
   * Useful for metadata operations
   */
  async getSourceInfo(sourceId: string): Promise<SourceInfo> {
    return this.findSourceInfo(sourceId);
  }
}

/**
 * Hook to create a source credentials manager instance
 */
export function useSourceCredentials() {
  // This will be imported in components that need it
  return {
    createManager: (passphraseHook: {
      getPassphrase: (accountId: string, options?: any) => Promise<string>;
    }) => new SourceCredentialsManager(passphraseHook),
  };
}
