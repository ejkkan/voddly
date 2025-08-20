'use client';

export type CatalogResult = {
  categories: Array<any & { type?: 'live' | 'vod' | 'series' }>;
  movies: any[];
  series: any[];
  channels: any[];
};

export interface IptvClient {
  // High-level aggregate
  getCatalog(): Promise<CatalogResult>;

  // Optional granular methods (not all providers support these)
  getLiveCategories?(): Promise<any[]>;
  getVodCategories?(): Promise<any[]>;
  getSeriesCategories?(): Promise<any[]>;

  getLiveStreams?(): Promise<any[]>;
  getVodStreams?(): Promise<any[]>;
  getSeriesList?(): Promise<any[]>;

  getLiveStreamsByCategory?(categoryId: string | number): Promise<any[]>;
  getVodStreamsByCategory?(categoryId: string | number): Promise<any[]>;
  getSeriesByCategory?(categoryId: string | number): Promise<any[]>;

  getVodInfo?(vodId: string | number): Promise<any | null>;
  getSeriesInfo?(seriesId: string | number): Promise<any | null>;
  getShortEpg?(streamId: string | number, limit?: number): Promise<any | null>;
}
