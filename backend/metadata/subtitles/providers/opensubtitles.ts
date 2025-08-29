import log from 'encore.dev/log';
import { BaseSubtitleProvider } from './base';
import {
  type SubtitleSearchParams,
  type SubtitleMetadata,
  type SubtitleLanguage,
} from '../types';

interface OpenSubtitlesSubtitle {
  id: string;
  type: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    new_download_count: number;
    hearing_impaired: boolean;
    hd: boolean;
    fps: number;
    votes: number;
    points: number;
    ratings: number;
    from_trusted: boolean;
    foreign_parts_only: boolean;
    ai_translated: boolean;
    machine_translated: boolean;
    upload_date: string;
    release: string;
    comments: string;
    legacy_subtitle_id: number;
    uploader: { uploader_id: number; name: string; rank: string };
    feature_details: {
      feature_id: number;
      feature_type: string;
      year: number;
      title: string;
      movie_name: string;
      imdb_id: number;
      tmdb_id: number;
    };
    url: string;
    related_links: { label: string; url: string; img_url: string }[];
    files: { file_id: number; cd_number: number; file_name: string }[];
  };
}

interface OpenSubtitlesResponse {
  total_pages: number;
  total_count: number;
  per_page: number;
  page: number;
  data: OpenSubtitlesSubtitle[];
}

export class OpenSubtitlesProvider extends BaseSubtitleProvider {
  name = 'OpenSubtitles';
  constructor(private apiKey?: string) {
    super();
  }

  async searchSubtitles(
    params: SubtitleSearchParams
  ): Promise<SubtitleMetadata[]> {
    const response = await this.callOpenSubtitlesAPI(params);
    if (!response.data || response.data.length === 0) return [];
    return response.data
      .filter((s) => Boolean(s.attributes?.language))
      .map((subtitle) => ({
        id: `opensubs_${subtitle.attributes.files[0]?.file_id || subtitle.id}`,
        language_code: subtitle.attributes.language,
        language_name: this.getLanguageName(subtitle.attributes.language),
        source: 'opensubs' as const,
        source_id:
          subtitle.attributes.files[0]?.file_id?.toString() || subtitle.id,
        download_count: subtitle.attributes.download_count,
        hearing_impaired: subtitle.attributes.hearing_impaired,
        ai_translated: subtitle.attributes.ai_translated,
        machine_translated: subtitle.attributes.machine_translated,
        quality_score: subtitle.attributes.points,
        release: subtitle.attributes.release,
        uploader: subtitle.attributes.uploader?.name,
      }));
  }

  async downloadSubtitle(
    _subtitleId: string,
    metadata: SubtitleMetadata
  ): Promise<string> {
    if (!this.apiKey) throw new Error('OpenSubtitles API key not provided');

    const fileId = parseInt(metadata.source_id);
    log.info('🔽 OpenSubtitles download request', {
      subtitleId: _subtitleId,
      sourceId: metadata.source_id,
      fileId,
      isValidFileId: !isNaN(fileId),
    });

    if (isNaN(fileId)) {
      throw new Error(
        `Invalid file_id: ${metadata.source_id} cannot be parsed as integer`
      );
    }

    const response = await fetch(
      'https://api.opensubtitles.com/api/v1/download',
      {
        method: 'POST',
        headers: {
          'Api-Key': this.apiKey,
          'User-Agent': 'IPTV-App v1.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: fileId }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log.error('OpenSubtitles download API error', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        fileId,
      });
      throw new Error(
        `OpenSubtitles download error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const { link } = (await response.json()) as { link: string };
    log.info('📥 Got download link from OpenSubtitles', {
      link: link.substring(0, 100) + '...',
    });

    const subtitleResponse = await fetch(link);
    if (!subtitleResponse.ok) {
      log.error('Failed to download subtitle file from link', {
        status: subtitleResponse.status,
        statusText: subtitleResponse.statusText,
        link: link.substring(0, 100) + '...',
      });
      throw new Error(
        `Failed to download subtitle file: ${subtitleResponse.status}`
      );
    }

    const content = await subtitleResponse.text();
    log.info('✅ Successfully downloaded subtitle content', {
      contentLength: content.length,
      firstLine: content.split('\n')[0],
    });

    return content;
  }

  async getAvailableLanguages(
    params: SubtitleSearchParams
  ): Promise<SubtitleLanguage[]> {
    const response = await this.callOpenSubtitlesAPI(params);
    if (!response.data || response.data.length === 0) return [];
    const counts = new Map<string, number>();
    for (const s of response.data) {
      const lang = s.attributes?.language;
      if (!lang) continue;
      counts.set(lang, (counts.get(lang) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({
        code,
        name: this.getLanguageName(code),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async callOpenSubtitlesAPI(
    params: SubtitleSearchParams
  ): Promise<OpenSubtitlesResponse> {
    if (!this.apiKey) throw new Error('OpenSubtitles API key not provided');
    const url = new URL('https://api.opensubtitles.com/api/v1/subtitles');
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null)
        url.searchParams.append(key, value.toString());
    });
    log.info(`🔍 Searching OpenSubtitles with params`, { params });
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Api-Key': this.apiKey,
        'User-Agent': 'IPTV-App v1.0.0',
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok)
      throw new Error(
        `OpenSubtitles API error: ${response.status} ${response.statusText}`
      );
    return response.json() as Promise<OpenSubtitlesResponse>;
  }
}
