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
    const targetId = String(sourceId).split(":")[0];
    console.log("🔍 Finding source info for:", sourceId, "→ normalized:", targetId);
    const accountsData = await apiClient.user.getAccounts();
    console.log(
      "📋 Available accounts:",
      accountsData.accounts.map((a) => ({ id: a.id, name: a.name })),
    );

    // Find the account that contains this source
    for (const account of accountsData.accounts) {
      console.log(
        `🔎 Checking account ${account.name} (${account.id}) for source ${sourceId}`,
      );
      try {
        const { sources, keyData } = await apiClient.user.getSources(account.id);
        console.log("📦 getSources raw for account", account.id, {
          numSources: sources?.length ?? 0,
          hasKeyData: !!keyData,
          keyDataMeta: keyData
            ? {
                kdf: (keyData as any).kdf,
                opslimit: (keyData as any).opslimit,
                memlimit: (keyData as any).memlimit,
              }
            : null,
        });
        console.log(
          `📂 Account ${account.name} has ${sources?.length || 0} sources:`,
          sources?.map((s) => ({ id: s.id, name: s.name, active: s.is_active })),
        );

        const source =
          sources?.find((s) => s.id === targetId) ||
          sources?.find((s) => s.name === targetId);
        console.log(
          `🎯 Source match for ${targetId}:`,
          source ? `Found: ${source.name}` : "Not found",
        );

        if (source && keyData) {
          console.log("✅ Source found with key data!");
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
        console.log(`❌ Error checking account ${account.name}:`, e);
        // Continue searching other accounts
        continue;
      }
    }

    console.error("❌ Source not found in any account after checking all accounts", {
      targetId,
      accountsTried: accountsData.accounts.map((a) => a.id),
    });
    throw new Error(`Source not found in any account (target=${targetId})`);
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
      console.log(
        "🔐 getSourceCredentials: Starting credential retrieval for source:",
        sourceId,
      );

      // Find the source and account info
      const sourceInfo = await this.findSourceInfo(sourceId);
      console.log(
        "✅ getSourceCredentials: Source info found for account:",
        sourceInfo.account.name,
      );

      // Get passphrase using the hook (will use cache or prompt)
      console.log(
        "🔐 getSourceCredentials: Getting passphrase for account:",
        sourceInfo.account.id,
      );
      const passphrase = await this.passphraseHook.getPassphrase(sourceInfo.account.id, {
        title: options.title || "Decrypt Source",
        message: options.message || "Enter your passphrase to decrypt the source",
        accountName: sourceInfo.account.name,
        validateFn: options.validatePassphrase,
      });

      console.log("✅ getSourceCredentials: Passphrase obtained");

      // Initialize encryption and decrypt
      console.log("🔐 getSourceCredentials: Initializing encryption");
      const encryption = new AccountEncryption();
      await encryption.initialize(passphrase, sourceInfo.account.id);

      console.log("🔐 getSourceCredentials: Getting master key");
      const masterKey = await encryption.getMasterKey(sourceInfo.keyData, passphrase);

      console.log("🔐 getSourceCredentials: Decrypting source configuration");
      const credentials = await encryption.decryptSource(
        {
          encrypted_config: sourceInfo.source.encrypted_config,
          config_iv: sourceInfo.source.config_iv,
        },
        masterKey,
      );

      console.log("✅ getSourceCredentials: Source credentials decrypted successfully");
      return credentials;
    } catch (error) {
      console.error("💥 getSourceCredentials: Failed to get source credentials:", error);

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
