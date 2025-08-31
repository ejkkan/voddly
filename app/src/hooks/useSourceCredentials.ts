import { useCallback } from 'react';

import { useAccountsData } from '@/hooks/ui/useAccounts';
import { useSourcesData } from '@/hooks/useSources';
import { SourceCredentialsManager } from '@/lib/source-credentials';
import { passphraseCache } from '@/lib/passphrase-cache';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';

// Hook that provides cached source credentials without making duplicate API calls
export function useSourceCredentialsCached() {
  const { data: accountsData } = useAccountsData();
  const { data: sourcesData } = useSourcesData();

  const getCredentials = useCallback(
    async (sourceId: string, options?: any) => {
      // Create credentials manager with cached data
      const manager = new SourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          const cached = passphraseCache.get(accountId);
          if (cached) return cached;
          const resolver = getRegisteredPassphraseResolver();
          if (!resolver) throw new Error('Passphrase required');
          return resolver(accountId, {
            title: opts?.title,
            message: opts?.message,
            accountName: opts?.accountName,
          });
        },
        // Pass cached data to avoid API calls
        accountsData,
        sourcesData,
      });

      return manager.getSourceCredentials(sourceId, options);
    },
    [accountsData, sourcesData]
  );

  return { getCredentials };
}
