import { useInfiniteCategorySections } from "./useInfiniteCategorySections";

export function useInfiniteLiveSections(
  sourceId: string,
  options?: { pageSize?: number; itemsPerCategory?: number },
) {
  return useInfiniteCategorySections(sourceId, "live", options);
}
