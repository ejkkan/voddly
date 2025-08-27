'use client';

import { XtreamClient, type XtreamCredentials } from '@/lib/xtream-client';

import type { CatalogResult, IptvClient } from './base';

export class XtreamIptvClient implements IptvClient {
  private readonly client: XtreamClient;
  constructor(creds: XtreamCredentials) {
    this.client = new XtreamClient(creds);
  }
  getCatalog(): Promise<CatalogResult> {
    return this.client.getCatalog();
  }
  getLiveCategories() {
    return this.client.getLiveCategories();
  }
  getVodCategories() {
    return this.client.getVodCategories();
  }
  getSeriesCategories() {
    return this.client.getSeriesCategories();
  }

  getLiveStreams() {
    return this.client.getLiveStreams();
  }
  getVodStreams() {
    return this.client.getVodStreams();
  }
  getSeriesList() {
    return this.client.getSeriesList();
  }

  getLiveStreamsByCategory(categoryId: string | number) {
    return this.client.getLiveStreamsByCategory(categoryId);
  }
  getVodStreamsByCategory(categoryId: string | number) {
    return this.client.getVodStreamsByCategory(categoryId);
  }
  getSeriesByCategory(categoryId: string | number) {
    return this.client.getSeriesByCategory(categoryId);
  }

  getVodInfo(vodId: string | number) {
    return this.client.getVodInfo(vodId);
  }
  getSeriesInfo(seriesId: string | number) {
    return this.client.getSeriesInfo(seriesId);
  }
  getShortEpg(streamId: string | number, limit?: number) {
    return this.client.getShortEpg(streamId, limit);
  }
}
