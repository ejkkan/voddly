import { useCallback, useState } from 'react';

import { openDb } from '@/lib/db';
import { fetchXtreamLiveShortEPG } from '@/lib/item-fetchers';
import { useSourceCredentials } from '@/lib/source-credentials';

export function useFetchRemoteLive() {
  const { getCredentials } = useSourceCredentials();
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRemote = useCallback(
    async (params: { id: string; sourceId: string; sourceItemId: string }) => {
      if (isFetching) return false;
      setIsFetching(true);
      setError(null);
      try {
        const creds = await getCredentials(params.sourceId, {
          title: 'Fetch Remote',
          message: 'Enter your passphrase to fetch channel EPG',
        });
        const data = await fetchXtreamLiveShortEPG(
          {
            server: creds.server,
            username: creds.username,
            password: creds.password,
          },
          params.sourceItemId
        );
        if (!data) throw new Error('No data returned');

        const listings = Array.isArray(data.epg_listings)
          ? data.epg_listings
          : [];
        const now = listings[0];
        const nowDesc = now
          ? String(now.title || '') +
            (now.description ? ` — ${String(now.description)}` : '')
          : null;

        const db = await openDb();
        await db.runAsync(
          `UPDATE content_items
           SET description = COALESCE($description, description),
               original_payload_json = $payload
           WHERE id = $id`,
          {
            $id: params.id,
            $description: nowDesc,
            $payload: JSON.stringify(data),
          }
        );
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to fetch remote channel'
        );
        return false;
      } finally {
        setIsFetching(false);
      }
    },
    [getCredentials, isFetching]
  );

  return { fetchRemote, isFetching, error } as const;
}
