import useInfiniteScroll from "react-infinite-scroll-hook";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useInfiniteContent } from "~/hooks/useInfiniteContent";
import { ContentCard } from "./ContentCard";

interface InfiniteContentGridProps {
  sourceId: string;
  contentType: "live" | "movies" | "series";
}

export function InfiniteContentGrid({ sourceId, contentType }: InfiniteContentGridProps) {
  const { items, loading, error, hasNextPage, loadMore } = useInfiniteContent({
    sourceId,
    contentType,
    pageSize: 50,
  });

  const [infiniteRef] = useInfiniteScroll({
    loading,
    hasNextPage,
    onLoadMore: loadMore,
    disabled: Boolean(error),
    rootMargin: "0px 0px 400px 0px",
  });

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && items.length === 0) {
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

  if (items.length === 0) {
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
    <div>
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

      {/* Loading indicator for infinite scroll */}
      {hasNextPage && (
        <div ref={infiniteRef} className="flex justify-center py-8">
          {loading && <LoadingSpinner size="md" />}
        </div>
      )}

      {/* Error state for additional loads */}
      {error && items.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground text-sm">
              Failed to load more content. Scroll to try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
