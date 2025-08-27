import { useCallback, useState } from 'react';

import { openDb } from '@/lib/db';
import { fetchXtreamVodInfo } from '@/lib/item-fetchers';
import { useSourceCredentials } from '@/lib/source-credentials';

export function useFetchRemoteMovie() {
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
          message: 'Enter your passphrase to fetch the latest movie metadata',
        });
        const data = await fetchXtreamVodInfo(
          {
            server: creds.server,
            username: creds.username,
            password: creds.password,
          },
          params.sourceItemId
        );
        if (!data) throw new Error('No data returned');

        const info = data.info || {};
        const movie = data.movie_data || {};

        const title = String(movie.name ?? info.name ?? '');
        const description = String(info.plot ?? '');
        const poster = String(info.cover ?? info.movie_image ?? '');
        const backdrop = Array.isArray(info.backdrop_path)
          ? String(info.backdrop_path[0] ?? '')
          : null;
        const releaseDate =
          String(info.releasedate ?? info.releaseDate ?? '') || null;
        const rating = Number(info.rating ?? 0) || 0;
        const rating5 = Number(info.rating_5based ?? 0) || 0;
        const addedAt = movie.added
          ? new Date(Number(movie.added) * 1000).toISOString()
          : null;
        const tmdbId = String(info.tmdb_id ?? info.tmdb ?? '').trim() || null;
        const runtimeMinutes =
          typeof info.episode_run_time === 'number'
            ? info.episode_run_time
            : Number(info.duration_secs ?? 0) > 0
              ? Math.round(Number(info.duration_secs) / 60)
              : null;
        const videoCodec = String(info.video?.codec_name ?? '').trim() || null;
        const audioCodec = String(info.audio?.codec_name ?? '').trim() || null;
        const width = Number(info.video?.width ?? 0) || null;
        const height = Number(info.video?.height ?? 0) || null;
        const bitrate =
          Number(info.bitrate ?? info.video?.tags?.BPS ?? 0) || null;
        const containerExtension =
          String(movie.container_extension ?? '').trim() || null;
        const trailer = String(info.youtube_trailer ?? '').trim() || null;

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
               added_at = COALESCE($added_at, added_at),
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
            $added_at: addedAt,
            $payload: JSON.stringify(data),
          }
        );
        // Upsert movies_ext
        await db.runAsync(
          `INSERT INTO movies_ext (item_id, stream_id, runtime_minutes, container_extension, trailer, bitrate, video_codec, audio_codec, width, height, tech_json)
           VALUES ($item_id, $stream_id, $runtime_minutes, $container_extension, $trailer, $bitrate, $video_codec, $audio_codec, $width, $height, $tech_json)
           ON CONFLICT(item_id) DO UPDATE SET
             stream_id = excluded.stream_id,
             runtime_minutes = COALESCE(excluded.runtime_minutes, movies_ext.runtime_minutes),
             container_extension = COALESCE(excluded.container_extension, movies_ext.container_extension),
             trailer = COALESCE(excluded.trailer, movies_ext.trailer),
             bitrate = COALESCE(excluded.bitrate, movies_ext.bitrate),
             video_codec = COALESCE(excluded.video_codec, movies_ext.video_codec),
             audio_codec = COALESCE(excluded.audio_codec, movies_ext.audio_codec),
             width = COALESCE(excluded.width, movies_ext.width),
             height = COALESCE(excluded.height, movies_ext.height),
             tech_json = excluded.tech_json
          `,
          {
            $item_id: params.id,
            $stream_id: String(movie.stream_id ?? ''),
            $runtime_minutes: runtimeMinutes,
            $container_extension: containerExtension,
            $trailer: trailer,
            $bitrate: bitrate,
            $video_codec: videoCodec,
            $audio_codec: audioCodec,
            $width: width,
            $height: height,
            $tech_json: JSON.stringify({
              video: info.video,
              audio: info.audio,
            }),
          }
        );
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to fetch remote movie'
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
