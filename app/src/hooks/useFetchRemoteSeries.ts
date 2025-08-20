import { useCallback, useState } from 'react';
import { useSourceCredentials } from '@/lib/source-credentials';
import { fetchXtreamSeriesInfo } from '@/lib/item-fetchers';
import { openDb } from '@/lib/db';

export function useFetchRemoteSeries() {
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
          message: 'Enter your passphrase to fetch the latest series metadata',
        });
        const data = await fetchXtreamSeriesInfo(
          {
            server: creds.server,
            username: creds.username,
            password: creds.password,
          },
          params.sourceItemId
        );
        if (!data) throw new Error('No data returned');

        const info = data.info || {};
        const title = String(info.name ?? '');
        const description = String(info.plot ?? '');
        const poster = String(info.cover ?? '');
        const backdrop = Array.isArray(info.backdrop_path)
          ? String(info.backdrop_path[0] ?? '')
          : null;
        const releaseDate =
          String(info.releaseDate ?? info.releasedate ?? '') || null;
        const rating = Number(info.rating ?? 0) || 0;
        const rating5 = Number(info.rating_5based ?? 0) || 0;
        const lastModified = data.last_modified
          ? new Date(Number(data.last_modified) * 1000).toISOString()
          : null;
        const tmdbId = String(info.tmdb ?? info.tmdb_id ?? '').trim() || null;
        const episodeRunTime = Number(info.episode_run_time ?? 0) || null;

        const db = await openDb();
        await db.runAsync(
          `UPDATE content_items
           SET title = $title,
               description = $description,
               poster_url = $poster_url,
               backdrop_url = $backdrop_url,
               release_date = $release_date,
               rating = $rating,
               rating_5based = $rating_5based,
               tmdb_id = COALESCE($tmdb_id, tmdb_id),
               last_modified = COALESCE($last_modified, last_modified),
               original_payload_json = $payload
           WHERE id = $id`,
          {
            $id: params.id,
            $title: title,
            $description: description || null,
            $poster_url: poster || null,
            $backdrop_url: backdrop || null,
            $release_date: releaseDate,
            $rating: rating,
            $rating_5based: rating5,
            $tmdb_id: tmdbId,
            $last_modified: lastModified,
            $payload: JSON.stringify(data),
          }
        );
        await db.runAsync(
          `INSERT INTO series_ext (item_id, tmdb_id, episode_run_time)
           VALUES ($item_id, $tmdb_id_ext, $episode_run_time)
           ON CONFLICT(item_id) DO UPDATE SET
             tmdb_id = COALESCE(excluded.tmdb_id, series_ext.tmdb_id),
             episode_run_time = COALESCE(excluded.episode_run_time, series_ext.episode_run_time)
          `,
          {
            $item_id: params.id,
            $tmdb_id_ext: tmdbId,
            $episode_run_time: episodeRunTime,
          }
        );

        // Upsert episodes into episodes_ext
        const seasons = Array.isArray(data.seasons) ? data.seasons : [];
        const episodesObj =
          data.episodes && typeof data.episodes === 'object'
            ? data.episodes
            : {};
        for (const seasonEntry of seasons) {
          const seasonNum =
            Number(seasonEntry?.season_number ?? seasonEntry?.season ?? 0) || 0;
          const seasonEpisodes: any[] = Array.isArray(
            episodesObj[String(seasonNum)]
          )
            ? episodesObj[String(seasonNum)]
            : [];
          for (const ep of seasonEpisodes) {
            const episodeNumber =
              Number(ep.episode_num ?? ep.episode ?? 0) || 0;
            const episodeId = `${params.id}:${seasonNum}:${episodeNumber}`;
            const titleEp = String(ep.title ?? 'Episode');
            const descriptionEp = String(ep.info?.plot ?? '');
            const airDate = String(ep.info?.release_date ?? '') || null;
            const streamId = String(ep.id ?? '');
            const lastModEp = ep.added
              ? new Date(Number(ep.added) * 1000).toISOString()
              : null;
            await db.runAsync(
              `INSERT INTO episodes_ext (id, series_item_id, season_number, episode_number, title, description, air_date, stream_id, last_modified, original_payload_json)
               VALUES ($id, $series_item_id, $season_number, $episode_number, $title, $description, $air_date, $stream_id, $last_modified, $payload)
               ON CONFLICT(id) DO UPDATE SET
                 title = excluded.title,
                 description = COALESCE(excluded.description, episodes_ext.description),
                 air_date = COALESCE(excluded.air_date, episodes_ext.air_date),
                 stream_id = COALESCE(excluded.stream_id, episodes_ext.stream_id),
                 last_modified = COALESCE(excluded.last_modified, episodes_ext.last_modified),
                 original_payload_json = excluded.original_payload_json
              `,
              {
                $id: episodeId,
                $series_item_id: params.id,
                $season_number: seasonNum,
                $episode_number: episodeNumber,
                $title: titleEp,
                $description: descriptionEp || null,
                $air_date: airDate,
                $stream_id: streamId,
                $last_modified: lastModEp,
                $payload: JSON.stringify(ep),
              }
            );
          }
        }
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to fetch remote series'
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
