import { useInfiniteCategorySections } from "./useInfiniteCategorySections";

export function useInfiniteSeriesSections(
  sourceId: string,
  options?: { pageSize?: number; itemsPerCategory?: number },
) {
  return useInfiniteCategorySections(sourceId, "series", options);
}
