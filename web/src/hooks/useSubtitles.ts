import { useCallback, useEffect, useState } from "react";
import { apiClient } from "~/lib/api-client";

interface Subtitle {
  id: string;
  language_code: string;
  language_name: string;
  content: string;
  source?: string;
}

interface SubtitleLanguage {
  code: string;
  name: string;
  count?: number;
}

interface SubtitleSearchParams {
  imdb_id?: number;
  tmdb_id?: number;
  parent_imdb_id?: number;
  parent_tmdb_id?: number;
  season_number?: number;
  episode_number?: number;
  query?: string;
  moviehash?: string;
  languages?: string;
  type?: "movie" | "episode" | "all";
  year?: number;
  preferred_provider?: "opensubs" | "subdl" | "all";
}

// New hook for getting available languages (step 1 of the new flow)
export function useAvailableLanguages(
  movieId: string,
  searchParams?: SubtitleSearchParams,
) {
  const [languages, setLanguages] = useState<SubtitleLanguage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movieId) return;

    const fetchLanguages = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(
          `🌐 Fetching available languages for movieId: ${movieId}`,
          searchParams,
        );
        const data = await apiClient.user.getAvailableLanguages(
          movieId,
          searchParams || {},
        );
        setLanguages(data.languages || []);
      } catch (error) {
        console.error("Failed to fetch available languages:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch available languages",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, [movieId, searchParams]);

  return { languages, loading, error };
}

// New hook for getting subtitle content on demand (step 2 of the new flow)
export function useSubtitleContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSubtitleContent = useCallback(
    async (
      movieId: string,
      languageCode: string,
      searchParams?: SubtitleSearchParams,
    ): Promise<Subtitle | null> => {
      setLoading(true);
      setError(null);
      try {
        console.log(`📝 Getting subtitle content for ${movieId} in ${languageCode}`);
        const data = await apiClient.user.getSubtitleContent(
          movieId,
          languageCode,
          searchParams || {},
        );
        return data.subtitle;
      } catch (error) {
        console.error("Failed to get subtitle content:", error);
        setError(
          error instanceof Error ? error.message : "Failed to get subtitle content",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { getSubtitleContent, loading, error };
}

// Legacy hook for backward compatibility - now fetches content for all available languages
export function useSubtitles(movieId: string, searchParams?: SubtitleSearchParams) {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movieId) return;

    const fetchSubtitles = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`📡 Fetching subtitles for movieId: ${movieId}`, searchParams);
        const data = await apiClient.user.getSubtitles(movieId, searchParams || {});
        setSubtitles(data.subtitles || []);
      } catch (error) {
        console.error("Failed to fetch subtitles:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch subtitles");
      } finally {
        setLoading(false);
      }
    };

    fetchSubtitles();
  }, [movieId, searchParams]);

  return { subtitles, loading, error };
}

// Legacy search hook - deprecated
export function useSubtitleSearch() {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSubtitles = useCallback(async (params: SubtitleSearchParams) => {
    console.warn(
      "useSubtitleSearch is deprecated. Use useAvailableLanguages and useSubtitleContent instead.",
    );
    setLoading(true);
    setError(
      "This search method is deprecated. Use useAvailableLanguages and useSubtitleContent instead.",
    );
    setLoading(false);
  }, []);

  return { searchResults, searchSubtitles, loading, error };
}

// Legacy download hook - deprecated
export function useSubtitleDownload() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadSubtitle = useCallback(async (fileId: string): Promise<string | null> => {
    console.warn("useSubtitleDownload is deprecated. Use useSubtitleContent instead.");
    setDownloading(true);
    setError(null);
    try {
      console.log(`⬇️ Downloading subtitle with fileId: ${fileId}`);
      const data = await apiClient.user.downloadSubtitleFile({ file_id: fileId });
      return data.content;
    } catch (error) {
      console.error("Failed to download subtitle:", error);
      setError(error instanceof Error ? error.message : "Failed to download subtitle");
      return null;
    } finally {
      setDownloading(false);
    }
  }, []);

  return { downloadSubtitle, downloading, error };
}
