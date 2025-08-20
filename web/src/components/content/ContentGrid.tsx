import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { CatalogStorage } from "~/lib/catalog-storage";
import { ContentCard } from "./ContentCard";

interface ContentGridProps {
  sourceId: string;
  contentType: "live" | "movies" | "series";
}

export function ContentGrid({ sourceId, contentType }: ContentGridProps) {
  const type =
    contentType === "movies" ? "movie" : contentType === "series" ? "series" : "live";
  const query = useQuery({
    queryKey: ["content-grid", sourceId, type],
    queryFn: async () => {
      const storage = new CatalogStorage();
      await storage.init();
      return storage.queryContent(sourceId, { type });
    },
    enabled: !!sourceId,
    refetchInterval: 2000,
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (query.error) {
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

  const items = query.data || [];
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
