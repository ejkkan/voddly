import { useCallback, useEffect, useState } from "react";
import { CatalogStorage, type ContentItem } from "~/lib/catalog-storage";

interface UseInfiniteContentOptions {
  sourceId: string;
  contentType: "live" | "movies" | "series";
  pageSize?: number;
}

interface UseInfiniteContentReturn {
  items: ContentItem[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useInfiniteContent({
  sourceId,
  contentType,
  pageSize = 50,
}: UseInfiniteContentOptions): UseInfiniteContentReturn {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const storage = new CatalogStorage();

  const loadItems = useCallback(
    async (currentOffset: number, append = false) => {
      if (loading) return;

      try {
        setLoading(true);
        setError(null);

        await storage.init();
        const type =
          contentType === "movies"
            ? "movie"
            : contentType === "series"
              ? "series"
              : "live";

        const results = await storage.queryContent(sourceId, {
          type,
          limit: pageSize,
          offset: currentOffset,
        });

        if (append) {
          setItems((prev) => [...prev, ...results]);
        } else {
          setItems(results);
        }

        // Check if we have more items
        setHasNextPage(results.length === pageSize);
        setOffset(currentOffset + results.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load content");
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    },
    [sourceId, contentType, pageSize, loading],
  );

  const loadMore = useCallback(() => {
    if (!loading && hasNextPage) {
      loadItems(offset, true);
    }
  }, [loadItems, offset, loading, hasNextPage]);

  const refresh = useCallback(() => {
    setItems([]);
    setOffset(0);
    setHasNextPage(true);
    setIsInitialLoad(true);
    loadItems(0, false);
  }, [loadItems]);

  // Initial load
  useEffect(() => {
    if (sourceId && isInitialLoad) {
      loadItems(0, false);
    }
  }, [sourceId, loadItems, isInitialLoad]);

  return {
    items,
    loading,
    error,
    hasNextPage,
    loadMore,
    refresh,
  };
}
