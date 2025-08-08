"use client";

import { useQuery } from "@tanstack/react-query";
import { CatalogStorage } from "~/lib/catalog-storage";

async function getSourceIdOrThrow(playlistId: string) {
  if (!playlistId) throw new Error("Source ID required");
  return String(playlistId);
}

export function useBrowseLive(playlistId: string) {
  return useQuery({
    queryKey: ["browse", "live", playlistId],
    queryFn: async () => {
      const sourceId = await getSourceIdOrThrow(playlistId);
      const storage = new CatalogStorage();
      await storage.init();
      return storage.queryContent(sourceId, { type: "live" });
    },
    enabled: !!playlistId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBrowseMovies(playlistId: string) {
  return useQuery({
    queryKey: ["browse", "movies", playlistId],
    queryFn: async () => {
      const sourceId = await getSourceIdOrThrow(playlistId);
      const storage = new CatalogStorage();
      await storage.init();
      return storage.queryContent(sourceId, { type: "movie" });
    },
    enabled: !!playlistId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBrowseSeries(playlistId: string) {
  return useQuery({
    queryKey: ["browse", "series", playlistId],
    queryFn: async () => {
      const sourceId = await getSourceIdOrThrow(playlistId);
      const storage = new CatalogStorage();
      await storage.init();
      return storage.queryContent(sourceId, { type: "series" });
    },
    enabled: !!playlistId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContentByType(
  playlistId: string,
  contentType: "live" | "movies" | "series",
) {
  return useQuery({
    queryKey: ["browse", contentType, playlistId],
    queryFn: async () => {
      const sourceId = await getSourceIdOrThrow(playlistId);
      const storage = new CatalogStorage();
      await storage.init();
      const type =
        contentType === "live" ? "live" : contentType === "movies" ? "movie" : "series";
      return storage.queryContent(sourceId, { type });
    },
    enabled: !!playlistId,
    staleTime: 5 * 60 * 1000,
  });
}
