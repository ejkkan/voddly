export interface CatalogData {
  categories?: any[];
  movies?: any[];
  series?: any[];
  channels?: any[];
}

export interface ContentItem {
  uid: string;
  sourceId: string;
  contentId: string;
  type: "movie" | "series" | "live";
  categoryId?: string;
  title: string;
  data: any;
  isFavorite: boolean;
  tmdbId?: number; // TMDB ID extracted during sync
}

export interface CatalogStats {
  total: number;
  movies: number;
  series: number;
  channels: number;
  lastUpdated?: string;
  sizeBytes?: number;
}

export class CatalogStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "IPTVCatalog";
  private readonly DB_VERSION = 1;
  private readonly MAX_SIZE = 40 * 1024 * 1024; // 40MB limit

  /**
   * Extract TMDB ID from movie data
   */
  private extractMovieTmdbId(movie: any): number | undefined {
    // Check various possible locations for TMDB ID
    if (movie.tmdb_id && !isNaN(Number(movie.tmdb_id))) {
      return Number(movie.tmdb_id);
    }
    if (movie.info?.tmdb_id && !isNaN(Number(movie.info.tmdb_id))) {
      return Number(movie.info.tmdb_id);
    }
    if (movie.tmdb && !isNaN(Number(movie.tmdb))) {
      return Number(movie.tmdb);
    }
    if (movie.info?.tmdb && !isNaN(Number(movie.info.tmdb))) {
      return Number(movie.info.tmdb);
    }
    return undefined;
  }

  /**
   * Extract TMDB ID from series data
   * Series can have TMDB ID at series level or episode level
   */
  private extractSeriesTmdbId(series: any): number | undefined {
    // Check series-level TMDB ID first
    if (series.tmdb_id && !isNaN(Number(series.tmdb_id))) {
      return Number(series.tmdb_id);
    }
    if (series.info?.tmdb_id && !isNaN(Number(series.info.tmdb_id))) {
      return Number(series.info.tmdb_id);
    }
    if (series.tmdb && !isNaN(Number(series.tmdb))) {
      return Number(series.tmdb);
    }
    if (series.info?.tmdb && !isNaN(Number(series.info.tmdb))) {
      return Number(series.info.tmdb);
    }

    // If no series-level TMDB ID, check episodes (from fresh data structure)
    if (series.seasons && Array.isArray(series.seasons)) {
      for (const season of series.seasons) {
        if (season.episodes && Array.isArray(season.episodes)) {
          for (const episode of season.episodes) {
            if (episode.info?.tmdb_id && !isNaN(Number(episode.info.tmdb_id))) {
              console.log(
                `🎬 Found TMDB ID ${episode.info.tmdb_id} from episode ${episode.episode_num} for series ${series.name || series.title}`,
              );
              return Number(episode.info.tmdb_id);
            }
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract TMDB ID from live channel data
   */
  private extractChannelTmdbId(channel: any): number | undefined {
    // Live channels typically don't have TMDB IDs, but check just in case
    if (channel.tmdb_id && !isNaN(Number(channel.tmdb_id))) {
      return Number(channel.tmdb_id);
    }
    if (channel.info?.tmdb_id && !isNaN(Number(channel.info.tmdb_id))) {
      return Number(channel.info.tmdb_id);
    }
    return undefined;
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store source metadata
        if (!db.objectStoreNames.contains("sources")) {
          const sourceStore = db.createObjectStore("sources", { keyPath: "id" });
          sourceStore.createIndex("byAccount", "accountId");
        }

        // Store full catalog data (for backup/reference)
        if (!db.objectStoreNames.contains("catalogs")) {
          const catalogStore = db.createObjectStore("catalogs", { keyPath: "sourceId" });
          catalogStore.createIndex("byUpdated", "updatedAt");
        }

        // Store individual content items for fast queries
        if (!db.objectStoreNames.contains("content")) {
          const contentStore = db.createObjectStore("content", {
            keyPath: "uid", // Composite key: sourceId_type_contentId
          });
          contentStore.createIndex("bySource", "sourceId");
          contentStore.createIndex("byType", ["sourceId", "type"]);
          contentStore.createIndex("byCategory", ["sourceId", "categoryId"]);
          contentStore.createIndex("byFavorite", ["sourceId", "isFavorite"]);
          contentStore.createIndex("byTitle", ["sourceId", "title"]);
        }
      };
    });
  }

  /**
   * Store catalog data for a source
   */
  async storeSourceCatalog(sourceId: string, data: CatalogData): Promise<void> {
    try {
      console.log(`💾 Starting IndexedDB storage for source ${sourceId}...`);

      if (!this.db) {
        console.log("🔧 Database not initialized, initializing...");
        await this.init();
      }

      // Check size limit
      const dataSize = new Blob([JSON.stringify(data)]).size;
      console.log(`📏 Data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);

      if (dataSize > this.MAX_SIZE) {
        throw new Error(`Catalog data exceeds ${this.MAX_SIZE / 1024 / 1024}MB limit`);
      }

      console.log(`🔄 Creating transaction for catalogs and content stores...`);
      const tx = this.db!.transaction(["catalogs", "content"], "readwrite");

      // Set up transaction error handling
      tx.onerror = (event) => {
        console.error("💥 Transaction error:", event);
      };

      tx.onabort = (event) => {
        console.error("💥 Transaction aborted:", event);
      };

      // Store raw catalog for reference
      console.log(`📦 Storing catalog metadata...`);
      await this.promisifyRequest(
        tx.objectStore("catalogs").put({
          sourceId,
          data,
          updatedAt: new Date().toISOString(),
          sizeBytes: dataSize,
        }),
      );

      // Clear old content for this source
      console.log(`🧹 Clearing old content for source ${sourceId}...`);
      const contentStore = tx.objectStore("content");
      const existingKeys = await this.promisifyRequest(
        contentStore.index("bySource").getAllKeys(sourceId),
      );

      console.log(`🗑️ Found ${existingKeys.length} existing items to remove`);
      for (const key of existingKeys) {
        await this.promisifyRequest(contentStore.delete(key));
      }

      let totalItems = 0;

      // Add movies
      if (data.movies && data.movies.length > 0) {
        console.log(`🎬 Storing ${data.movies.length} movies...`);
        for (const movie of data.movies) {
          try {
            const tmdbId = this.extractMovieTmdbId(movie);
            const item: ContentItem = {
              uid: `${sourceId}_movie_${movie.stream_id || movie.id}`,
              sourceId,
              contentId: String(movie.stream_id || movie.id),
              type: "movie",
              categoryId: movie.category_id,
              title: movie.name || movie.title || "Unknown",
              data: movie,
              isFavorite: false,
              tmdbId,
            };
            if (tmdbId) {
              console.log(`🎬 Stored movie "${item.title}" with TMDB ID: ${tmdbId}`);
            }
            await this.promisifyRequest(contentStore.add(item));
            totalItems++;
          } catch (error) {
            console.error(
              `❌ Failed to store movie ${movie.name || movie.title}:`,
              error,
            );
            // Continue with other movies instead of failing completely
          }
        }
      }

      // Add series
      if (data.series && data.series.length > 0) {
        console.log(`📺 Storing ${data.series.length} series...`);
        for (const series of data.series) {
          try {
            const tmdbId = this.extractSeriesTmdbId(series);
            const item: ContentItem = {
              uid: `${sourceId}_series_${series.series_id || series.id}`,
              sourceId,
              contentId: String(series.series_id || series.id),
              type: "series",
              categoryId: series.category_id,
              title: series.name || series.title || "Unknown",
              data: series,
              isFavorite: false,
              tmdbId,
            };
            if (tmdbId) {
              console.log(`📺 Stored series "${item.title}" with TMDB ID: ${tmdbId}`);
            }
            await this.promisifyRequest(contentStore.add(item));
            totalItems++;
          } catch (error) {
            console.error(
              `❌ Failed to store series ${series.name || series.title}:`,
              error,
            );
            // Continue with other series instead of failing completely
          }
        }
      }

      // Add live channels
      if (data.channels && data.channels.length > 0) {
        console.log(`📡 Storing ${data.channels.length} channels...`);
        for (const channel of data.channels) {
          try {
            const tmdbId = this.extractChannelTmdbId(channel);
            const item: ContentItem = {
              uid: `${sourceId}_live_${channel.stream_id || channel.id}`,
              sourceId,
              contentId: String(channel.stream_id || channel.id),
              type: "live",
              categoryId: channel.category_id,
              title: channel.name || channel.title || "Unknown",
              data: channel,
              isFavorite: false,
              tmdbId,
            };
            if (tmdbId) {
              console.log(`📡 Stored channel "${item.title}" with TMDB ID: ${tmdbId}`);
            }
            await this.promisifyRequest(contentStore.add(item));
            totalItems++;
          } catch (error) {
            console.error(
              `❌ Failed to store channel ${channel.name || channel.title}:`,
              error,
            );
            // Continue with other channels instead of failing completely
          }
        }
      }

      console.log(`🎯 Committing transaction with ${totalItems} items...`);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(
            `✅ IndexedDB storage completed successfully for source ${sourceId}`,
          );
          resolve();
        };
        tx.onerror = (event) => {
          console.error(`💥 Transaction failed for source ${sourceId}:`, event);
          reject(
            new Error(
              `Transaction failed: ${tx.error?.message || "Unknown transaction error"}`,
            ),
          );
        };
        tx.onabort = (event) => {
          console.error(`💥 Transaction aborted for source ${sourceId}:`, event);
          reject(
            new Error(
              `Transaction aborted: ${tx.error?.message || "Transaction was aborted"}`,
            ),
          );
        };
      });
    } catch (error) {
      console.error(`💥 IndexedDB storage failed for source ${sourceId}:`, error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("quota")) {
          throw new Error(
            `Storage quota exceeded. Please clear some data and try again.`,
          );
        } else if (error.message.includes("readonly")) {
          throw new Error(`Database is in read-only mode. Cannot store data.`);
        } else if (error.message.includes("blocked")) {
          throw new Error(`Database is blocked by another operation. Please try again.`);
        } else {
          throw new Error(`Database storage failed: ${error.message}`);
        }
      } else {
        throw new Error(`Unknown database storage error`);
      }
    }
  }

  /**
   * Get catalog data for a source
   */
  async getSourceCatalog(sourceId: string): Promise<CatalogData | null> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["catalogs"], "readonly");
    const result = await this.promisifyRequest(tx.objectStore("catalogs").get(sourceId));

    return result?.data || null;
  }

  /**
   * Update a content item with fresh data (including TMDB info)
   */
  async updateContentItemWithFreshData(
    sourceId: string,
    contentId: string,
    contentType: "movie" | "series" | "live",
    freshData: any,
  ): Promise<void> {
    if (!this.db) await this.init();

    const uid = `${sourceId}_${contentType}_${contentId}`;
    const tx = this.db!.transaction(["content"], "readwrite");
    const contentStore = tx.objectStore("content");

    // Get existing item
    const existingItem = await this.promisifyRequest(contentStore.get(uid));
    if (!existingItem) {
      console.warn(`Content item ${uid} not found for update`);
      return;
    }

    // Extract TMDB ID from fresh data
    let tmdbId: number | undefined;
    switch (contentType) {
      case "movie":
        tmdbId = this.extractMovieTmdbId(freshData);
        break;
      case "series":
        tmdbId = this.extractSeriesTmdbId(freshData);
        break;
      case "live":
        tmdbId = this.extractChannelTmdbId(freshData);
        break;
    }

    // Update the item with fresh data and TMDB ID
    const updatedItem: ContentItem = {
      ...existingItem,
      data: { ...existingItem.data, ...freshData }, // Merge fresh data
      tmdbId: tmdbId || existingItem.tmdbId, // Use new TMDB ID or keep existing
    };

    await this.promisifyRequest(contentStore.put(updatedItem));

    if (tmdbId && tmdbId !== existingItem.tmdbId) {
      console.log(
        `🔄 Updated ${contentType} "${existingItem.title}" with TMDB ID: ${tmdbId}`,
      );
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Query content with filters
   */
  async queryContent(
    sourceId: string,
    options?: {
      type?: "movie" | "series" | "live";
      categoryId?: string;
      search?: string;
      favorites?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<ContentItem[]> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["content"], "readonly");
    const store = tx.objectStore("content");

    let results: ContentItem[] = [];

    // Use appropriate index based on filters
    if (options?.favorites) {
      const index = store.index("byFavorite");
      results = await this.promisifyRequest(index.getAll([sourceId, true]));
    } else if (options?.categoryId && options?.type) {
      const index = store.index("byCategory");
      const items = await this.promisifyRequest(
        index.getAll([sourceId, options.categoryId]),
      );
      results = items.filter((item) => item.type === options.type);
    } else if (options?.type) {
      const index = store.index("byType");
      results = await this.promisifyRequest(index.getAll([sourceId, options.type]));
    } else {
      const index = store.index("bySource");
      results = await this.promisifyRequest(index.getAll(sourceId));
    }

    // Apply search filter
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter((item) => item.title.toLowerCase().includes(searchLower));
    }

    // Apply pagination
    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get a single content item
   */
  async getContentItem(
    sourceId: string,
    type: "movie" | "series" | "live",
    contentId: string,
  ): Promise<ContentItem | null> {
    if (!this.db) await this.init();

    const uid = `${sourceId}_${type}_${contentId}`;
    const tx = this.db!.transaction(["content"], "readonly");
    const result = await this.promisifyRequest(tx.objectStore("content").get(uid));

    return result || null;
  }

  /**
   * Get content items by TMDB ID
   */
  async getContentItemsByTmdbId(
    sourceId: string,
    tmdbId: number,
    type?: "movie" | "series" | "live",
  ): Promise<ContentItem[]> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["content"], "readonly");
    const contentStore = tx.objectStore("content");

    // Get all items for the source
    const allItems = await this.promisifyRequest(
      contentStore.index("bySource").getAll(sourceId),
    );

    // Filter by TMDB ID and optionally by type
    const matches = allItems.filter((item: ContentItem) => {
      const matchesTmdb = item.tmdbId === tmdbId;
      const matchesType = !type || item.type === type;
      return matchesTmdb && matchesType;
    });

    return matches;
  }

  /**
   * Update favorite status
   */
  async toggleFavorite(
    sourceId: string,
    type: "movie" | "series" | "live",
    contentId: string,
  ): Promise<boolean> {
    if (!this.db) await this.init();

    const uid = `${sourceId}_${type}_${contentId}`;
    const tx = this.db!.transaction(["content"], "readwrite");
    const store = tx.objectStore("content");

    const item = await this.promisifyRequest(store.get(uid));
    if (item) {
      item.isFavorite = !item.isFavorite;
      await this.promisifyRequest(store.put(item));
      return item.isFavorite;
    }

    return false;
  }

  /**
   * Get catalog statistics
   */
  async getCatalogStats(sourceId: string): Promise<CatalogStats> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["content", "catalogs"], "readonly");

    // Get content counts
    const index = tx.objectStore("content").index("bySource");
    const all = await this.promisifyRequest(index.getAll(sourceId));

    // Get catalog metadata
    const catalog = await this.promisifyRequest(tx.objectStore("catalogs").get(sourceId));

    return {
      total: all.length,
      movies: all.filter((i) => i.type === "movie").length,
      series: all.filter((i) => i.type === "series").length,
      channels: all.filter((i) => i.type === "live").length,
      lastUpdated: catalog?.updatedAt,
      sizeBytes: catalog?.sizeBytes,
    };
  }

  /**
   * Clear all data for a source
   */
  async clearSourceData(sourceId: string): Promise<void> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["catalogs", "content"], "readwrite");

    // Delete catalog
    await this.promisifyRequest(tx.objectStore("catalogs").delete(sourceId));

    // Delete all content
    const contentStore = tx.objectStore("content");
    const keys = await this.promisifyRequest(
      contentStore.index("bySource").getAllKeys(sourceId),
    );

    for (const key of keys) {
      await this.promisifyRequest(contentStore.delete(key));
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get total storage used
   */
  async getStorageInfo(): Promise<{
    used: number;
    sources: Array<{ sourceId: string; size: number; updated: string }>;
  }> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["catalogs"], "readonly");
    const catalogs = await this.promisifyRequest(tx.objectStore("catalogs").getAll());

    const sources = catalogs.map((c) => ({
      sourceId: c.sourceId,
      size: c.sizeBytes || 0,
      updated: c.updatedAt,
    }));

    const used = sources.reduce((sum, s) => sum + s.size, 0);

    return { used, sources };
  }

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["catalogs", "content", "sources"], "readwrite");

    await this.promisifyRequest(tx.objectStore("catalogs").clear());
    await this.promisifyRequest(tx.objectStore("content").clear());
    await this.promisifyRequest(tx.objectStore("sources").clear());

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Search across all content types with results grouped by category
   */
  async searchAllContent(
    query: string,
    sourceId?: string,
  ): Promise<{
    movies: ContentItem[];
    series: ContentItem[];
    live: ContentItem[];
    total: number;
  }> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["content"], "readonly");
    const store = tx.objectStore("content");

    let allResults: ContentItem[] = [];

    if (sourceId) {
      // Search within a specific source
      const index = store.index("bySource");
      allResults = await this.promisifyRequest(index.getAll(sourceId));
    } else {
      // Search across all sources
      allResults = await this.promisifyRequest(store.getAll());
    }

    // Filter by search query
    const searchLower = query.toLowerCase();
    const filtered = allResults.filter((item) =>
      item.title.toLowerCase().includes(searchLower),
    );

    // Group results by type
    const movies = filtered.filter((item) => item.type === "movie");
    const series = filtered.filter((item) => item.type === "series");
    const live = filtered.filter((item) => item.type === "live");

    return {
      movies,
      series,
      live,
      total: filtered.length,
    };
  }

  /**
   * Get all available sources with content counts
   */
  async getAllSources(): Promise<
    Array<{
      sourceId: string;
      stats: CatalogStats;
    }>
  > {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(["catalogs"], "readonly");
    const catalogs = await this.promisifyRequest(tx.objectStore("catalogs").getAll());

    const sources = await Promise.all(
      catalogs.map(async (catalog) => ({
        sourceId: catalog.sourceId,
        stats: await this.getCatalogStats(catalog.sourceId),
      })),
    );

    return sources;
  }

  /**
   * Helper to promisify IndexedDB requests
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
