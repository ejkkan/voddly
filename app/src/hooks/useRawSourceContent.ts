import { useCallback } from 'react';
import { SourceCredentialsManager } from '@/lib/source-credentials';
import { passphraseCache } from '@/lib/passphrase-cache';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';
import { constructStreamUrl, ContentType } from '@/lib/stream-url';

export function useRawSourceContent() {
  const prepare = useCallback(
    async (
      sourceId: string,
      contentId: string | number,
      contentType: ContentType
    ) => {
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
      });
      const creds = await manager.getSourceCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to decrypt the source',
      });
      const { streamingUrl } = constructStreamUrl({
        server: creds.server,
        username: creds.username,
        password: creds.password,
        contentId,
        contentType,
        containerExtension: creds.containerExtension,
        videoCodec: creds.videoCodec,
        audioCodec: creds.audioCodec,
      });
      return { url: streamingUrl, credentials: creds } as const;
    },
    []
  );

  return { prepare };
}
