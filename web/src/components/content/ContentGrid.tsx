import * as React from "react";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { ContentCard } from "./ContentCard";
import { CatalogStorage, type ContentItem } from "~/lib/catalog-storage";

interface ContentGridProps {
  sourceId: string;
  contentType: "live" | "movies" | "series";
}

export function ContentGrid({ sourceId, contentType }: ContentGridProps) {
  const [items, setItems] = React.useState<ContentItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isCancelled = false;
    const storage = new CatalogStorage();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        await storage.init();
        const type = contentType === "movies" ? "movie" : contentType === "series" ? "series" : "live";
        const results = await storage.queryContent(sourceId, { type });
        if (!isCancelled) setItems(results);
      } catch (e) {
        if (!isCancelled) setError(e instanceof Error ? e.message : "Failed to load content");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, [sourceId, contentType]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-12">
        <div className="space-y-2 text-center">
          <h3 className="text-foreground text-lg font-semibold">Error Loading Content</h3>
          <p className="text-muted-foreground">
            Failed to load {contentType}. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="space-y-2 text-center">
          <h3 className="text-foreground text-lg font-semibold">No Content Available</h3>
          <p className="text-muted-foreground">
            No {contentType} found in this playlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item, index) => (
        <ContentCard
          key={`${item.contentId || item.data?.id || index}-${index}`}
          item={item}
          contentType={contentType}
          playlistId={sourceId}
        />
      ))}
    </div>
  );
}
