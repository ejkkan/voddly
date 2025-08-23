import { useCallback } from 'react';
import { SourceCredentialsManager } from '@/lib/source-credentials';
import { passphraseCache } from '@/lib/passphrase-cache';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';
import { openDb } from '@/lib/db';
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
      // Prefer locally stored container extension for movies when available
      let containerExtension: string | undefined = creds.containerExtension;
      let videoCodec: string | undefined = creds.videoCodec;
      let audioCodec: string | undefined = creds.audioCodec;
      try {
        if (contentType === 'movie') {
          const db = await openDb();
          const rows = await db.getAllAsync<{
            container_extension: string | null;
            video_codec: string | null;
            audio_codec: string | null;
          }>(
            `SELECT container_extension, video_codec, audio_codec FROM movies_ext WHERE item_id = $id LIMIT 1`,
            { $id: String(contentId) }
          );
          const first = rows && rows[0];
          if (first) {
            if (first.container_extension)
              containerExtension = String(first.container_extension);
            if (first.video_codec) videoCodec = String(first.video_codec);
            if (first.audio_codec) audioCodec = String(first.audio_codec);
          }
        }
      } catch {}
      const { streamingUrl } = constructStreamUrl({
        server: creds.server,
        username: creds.username,
        password: creds.password,
        contentId,
        contentType,
        containerExtension,
        videoCodec,
        audioCodec,
      });
      return { url: streamingUrl, credentials: creds } as const;
    },
    []
  );

  return { prepare };
}
