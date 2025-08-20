import { useInfiniteCategorySections } from "./useInfiniteCategorySections";

export function useInfiniteMoviesSections(
  sourceId: string,
  options?: { pageSize?: number; itemsPerCategory?: number },
) {
  return useInfiniteCategorySections(sourceId, "movies", options);
}
