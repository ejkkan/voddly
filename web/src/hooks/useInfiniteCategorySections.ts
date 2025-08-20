import { useInfiniteQuery } from "@tanstack/react-query";
import { CatalogStorage, type ContentItem } from "~/lib/catalog-storage";

type UiContentType = "movies" | "series" | "live";

export interface CategorySection {
  categoryId: string;
  categoryName: string;
  items: ContentItem[];
}

function mapUiTypeToStorage(ui: UiContentType): "movie" | "series" | "live" {
  return ui === "movies" ? "movie" : ui === "series" ? "series" : "live";
}

function mapUiTypeToCatalog(ui: UiContentType): "vod" | "series" | "live" {
  return ui === "movies" ? "vod" : ui === "series" ? "series" : "live";
}

export function useInfiniteCategorySections(
  sourceId: string,
  contentType: UiContentType,
  options?: { pageSize?: number; itemsPerCategory?: number },
) {
  const pageSize = options?.pageSize ?? 10;
  const itemsPerCategory = options?.itemsPerCategory ?? 20;
  const uniqBy = <T>(arr: T[], getKey: (t: T) => string) => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of arr) {
      const k = getKey(it);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(it);
      }
    }
    return out;
  };

  return useInfiniteQuery<{ sections: CategorySection[]; nextOffset?: number }>({
    queryKey: ["category-sections", sourceId, contentType, pageSize, itemsPerCategory],
    queryFn: async ({ pageParam }) => {
      const offset: number = typeof pageParam === "number" ? pageParam : 0;
      const storage = new CatalogStorage();
      await storage.init();
      const catalog = await storage.getSourceCatalog(sourceId);
      type Cat = {
        category_id?: string | number;
        id?: string | number;
        name?: string;
        category_name?: string;
        type?: string;
      };
      const allCategoriesRaw = (catalog?.categories || []).filter((c: Cat) => {
        const target = mapUiTypeToCatalog(contentType);
        return (c?.type || "").toLowerCase() === target;
      });
      // Deduplicate categories by stable key per type
      const allCategories = uniqBy<Cat>(allCategoriesRaw, (c: Cat) => {
        const id = String(c?.category_id ?? c?.id ?? c?.name ?? "");
        return `${mapUiTypeToCatalog(contentType)}:${id}`;
      });

      const pageCats = allCategories.slice(offset, offset + pageSize);

      const sections: CategorySection[] = [];
      for (const cat of pageCats) {
        const rawItems = await storage.queryContent(sourceId, {
          type: mapUiTypeToStorage(contentType),
          categoryId: String((cat as Cat).category_id ?? (cat as Cat).id ?? ""),
          limit: itemsPerCategory,
        });
        const items = uniqBy(rawItems, (i) => String(i.contentId));
        const id = String((cat as Cat).category_id ?? (cat as Cat).id ?? "");
        const name = String((cat as Cat).category_name ?? (cat as Cat).name ?? "Unnamed");
        sections.push({
          categoryId: id,
          categoryName: name,
          items,
        });
      }

      const nextOffset =
        offset + pageSize < allCategories.length ? offset + pageSize : undefined;
      return { sections, nextOffset };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });
}
