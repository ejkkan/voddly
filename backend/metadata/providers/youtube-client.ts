import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';

const youtubeApiKey = secret('YouTubeApiKey');

export interface YouTubeVideo {
  id: string;
  title: string;
  description?: string;
  channelTitle?: string;
  publishedAt?: string;
  duration?: string;
  viewCount?: string;
  likeCount?: string;
}

export interface YouTubeSearchResult {
  kind: string;
  etag: string;
  id: {
    kind: string;
    videoId: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
    channelTitle: string;
    liveBroadcastContent: string;
  };
}

export interface YouTubeVideoDetails {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    tags?: string[];
    categoryId: string;
  };
  contentDetails: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
    dislikeCount?: string;
    favoriteCount: string;
    commentCount?: string;
  };
}

export class YouTubeClient {
  private baseUrl = 'https://www.googleapis.com/youtube/v3';
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await youtubeApiKey();
    }
    return this.apiKey;
  }

  async searchTrailer(query: string, maxResults: number = 1): Promise<YouTubeVideo[] | null> {
    try {
      const apiKey = await this.getApiKey();
      const searchQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}/search?part=snippet&q=${searchQuery}&type=video&maxResults=${maxResults}&key=${apiKey}`;
      const start = Date.now();
      log.debug('YouTube search request start', { url, query, maxResults });
      const response = await fetch(url);
      const durationMs = Date.now() - start;
      
      if (!response.ok) {
        log.warn('YouTube API error', { status: response.status, query, durationMs });
        return null;
      }
      log.debug('YouTube search request done', { status: response.status, durationMs, query });
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return null;
      }
      
      // Convert to simplified format
      const videos: YouTubeVideo[] = data.items.map((item: YouTubeSearchResult) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }));
      
      return videos;
    } catch (error) {
      log.error('YouTube search failed', { error, query });
      return null;
    }
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null> {
    try {
      const apiKey = await this.getApiKey();
      const url = `${this.baseUrl}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`;
      const start = Date.now();
      log.debug('YouTube details request start', { url, videoId });
      const response = await fetch(url);
      const durationMs = Date.now() - start;
      
      if (!response.ok) {
        log.warn('YouTube API error', { status: response.status, videoId, durationMs });
        return null;
      }
      log.debug('YouTube details request done', { status: response.status, durationMs, videoId });
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return null;
      }
      
      return data.items[0] as YouTubeVideoDetails;
    } catch (error) {
      log.error('YouTube video details fetch failed', { error, videoId });
      return null;
    }
  }

  async searchMovieTrailers(title: string, year?: string): Promise<YouTubeVideo[] | null> {
    // Build a more specific search query for movie trailers
    let query = `${title} ${year || ''} official trailer`;
    
    const videos = await this.searchTrailer(query, 3);
    
    if (!videos || videos.length === 0) {
      // Try a simpler search
      query = `${title} trailer`;
      return this.searchTrailer(query, 3);
    }
    
    return videos;
  }

  async searchTVTrailers(title: string, season?: number): Promise<YouTubeVideo[] | null> {
    // Build a more specific search query for TV show trailers
    let query = season 
      ? `${title} season ${season} trailer`
      : `${title} official trailer`;
    
    const videos = await this.searchTrailer(query, 3);
    
    if (!videos || videos.length === 0) {
      // Try a simpler search
      query = `${title} trailer`;
      return this.searchTrailer(query, 3);
    }
    
    return videos;
  }
}