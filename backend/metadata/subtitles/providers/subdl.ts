import log from 'encore.dev/log';
import JSZip from 'jszip';
import { BaseSubtitleProvider } from './base';
import {
  type SubtitleSearchParams,
  type SubtitleMetadata,
  type SubtitleLanguage,
} from '../types';

interface SubDLSubtitle {
  sd_id: number;
  type: string;
  name: string;
  release_name: string;
  lang: string;
  language: string;
  author: string;
  url: string;
  season?: number;
  episode?: number;
  comment?: string;
  hearing_impaired?: boolean;
  download_count?: number;
  releases?: string[];
}

interface SubDLResult {
  imdb_id?: string;
  tmdb_id?: number;
  type: 'movie' | 'tv';
  name: string;
  sd_id: number;
  first_air_date?: string;
  year?: number;
}

interface SubDLResponse {
  status: boolean;
  results?: SubDLResult[];
  subtitles?: SubDLSubtitle[];
  error?: string;
}

export class SubDLProvider extends BaseSubtitleProvider {
  name = 'SubDL';
  constructor(private apiKey?: string) { super(); }

  async searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleMetadata[]> {
    const response = await this.callSubDLAPI(params);
    try {
      const sample = (response.subtitles || []).slice(0, 3).map((s) => ({ lang: (s as any).lang, language: (s as any).language, name: (s as any).name }));
      log.info('SubDL raw search insight', { status: response.status, subtitlesCount: (response.subtitles || []).length, sample });
    } catch {}
    if (!response.status || !response.subtitles || response.subtitles.length === 0) return [];
    return response.subtitles
      .filter((subtitle) => Boolean(subtitle.language))
      .map((subtitle) => ({
        id: `subdl_${subtitle.sd_id ?? subtitle.url ?? subtitle.name}`,
        language_code: subtitle.language.toLowerCase(),
        language_name: this.getLanguageName(subtitle.language.toLowerCase()),
        source: 'subdl' as const,
        source_id: String(subtitle.sd_id ?? subtitle.url ?? subtitle.name),
        download_count: subtitle.download_count || 0,
        hearing_impaired: subtitle.hearing_impaired || false,
        ai_translated: false,
        machine_translated: false,
        quality_score: subtitle.download_count || 0,
        release: subtitle.release_name,
        uploader: subtitle.author,
      }));
  }

  async downloadSubtitle(_subtitleId: string, metadata: SubtitleMetadata): Promise<string> {
    const downloadUrl = `https://dl.subdl.com/subtitle/${metadata.source_id}.zip`;
    log.info(`⬇️ Downloading SubDL subtitle from ${downloadUrl}`);
    const response = await fetch(downloadUrl, { method: 'GET', headers: { Accept: 'application/zip,application/octet-stream,*/*', 'User-Agent': 'Mozilla/5.0', Referer: 'https://subdl.com/', Origin: 'https://subdl.com' } });
    if (!response.ok) throw new Error(`SubDL download error: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    if (fileNames.length === 0) throw new Error('SubDL ZIP did not contain any files');
    const prioritize = (names: string[], ext: string) => names.filter((n) => n.toLowerCase().endsWith(ext));
    let candidates = fileNames;
    let ordered: string[] = [...prioritize(candidates, '.srt'), ...prioritize(candidates, '.vtt'), ...prioritize(candidates, '.sub'), ...prioritize(candidates, '.txt')];
    if (ordered.length === 0) ordered = [fileNames[0]];
    if (metadata.release) {
      const normalizedRelease = metadata.release.toLowerCase().replace(/\s+/g, '');
      const withScore = ordered.map((name) => ({ name, score: name.toLowerCase().replace(/\s+/g, '').includes(normalizedRelease) ? 1 : 0 }));
      withScore.sort((a, b) => b.score - a.score);
      ordered = withScore.map((x) => x.name);
    }
    const chosen = ordered[0];
    const file = zip.files[chosen];
    if (!file) throw new Error('Failed to select a subtitle file from SubDL ZIP');
    const content = await file.async('string');
    return content;
  }

  async getAvailableLanguages(params: SubtitleSearchParams): Promise<SubtitleLanguage[]> {
    const response = await this.callSubDLAPI(params);
    try {
      const sample = (response.subtitles || []).slice(0, 5).map((s) => ({ lang: (s as any).lang, language: (s as any).language, name: (s as any).name }));
      log.info('SubDL raw response insight', { status: response.status, subtitlesCount: (response.subtitles || []).length, sample });
    } catch {}
    if (!response.status || !response.subtitles || response.subtitles.length === 0) return [];
    const languageCount = new Map<string, number>();
    for (const subtitle of response.subtitles) {
      const lang = subtitle.language.toLowerCase();
      languageCount.set(lang, (languageCount.get(lang) || 0) + 1);
    }
    return Array.from(languageCount.entries()).map(([code, count]) => ({ code, name: this.getLanguageName(code), count })).sort((a, b) => b.count - a.count);
  }

  private async callSubDLAPI(params: SubtitleSearchParams): Promise<SubDLResponse> {
    if (!this.apiKey) throw new Error('SubDL API key not provided');
    const url = new URL('https://api.subdl.com/api/v1/subtitles');
    url.searchParams.append('api_key', this.apiKey);
    if (params.tmdb_id && !params.imdb_id) {
      url.searchParams.set('tmdb_id', params.tmdb_id.toString());
      const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`SubDL API error: ${response.status} ${response.statusText}`);
      return (await response.json()) as SubDLResponse;
    }
    const sanitizeFilmName = (name: string): string => name.replace(/\[[^\]]*\]/g, ' ').replace(/[^\w\s:'-]/g, ' ').replace(/\s+/g, ' ').trim();
    let filmName: string | undefined;
    if (params.query && !/^\d+$/.test(params.query)) {
      filmName = sanitizeFilmName(params.query);
      if (filmName) url.searchParams.append('film_name', filmName);
    }
    if (params.imdb_id) url.searchParams.append('imdb_id', params.imdb_id.toString());
    if (params.tmdb_id) url.searchParams.append('tmdb_id', params.tmdb_id.toString());
    if (params.season_number) url.searchParams.append('season_number', params.season_number.toString());
    if (params.episode_number) url.searchParams.append('episode_number', params.episode_number.toString());
    if (params.type) {
      const subdlType = params.type === 'episode' ? 'tv' : params.type === 'all' ? undefined : params.type;
      if (subdlType) url.searchParams.append('type', subdlType);
    }
    if (params.year) url.searchParams.append('year', params.year.toString());
    if (params.languages) url.searchParams.append('languages', params.languages.toUpperCase());
    url.searchParams.append('subs_per_page', '30');
    url.searchParams.append('comment', '1');
    url.searchParams.append('releases', '1');
    const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Origin: 'https://subdl.com', Referer: 'https://subdl.com/' } });
    if (!response.ok) throw new Error(`SubDL API error: ${response.status} ${response.statusText}`);
    let json: any;
    try { json = await response.json(); } catch (e) { log.error(e, 'Failed to parse SubDL JSON response'); throw e; }
    const shouldFallback = json && json.status === false && filmName && typeof json.error === 'string' && (json.error.toLowerCase().includes('unsafe') || json.error.toLowerCase().includes("can't find movie or tv"));
    if (shouldFallback) {
      const fallbackUrl = new URL('https://api.subdl.com/api/v1/subtitles');
      fallbackUrl.searchParams.append('api_key', this.apiKey!);
      fallbackUrl.searchParams.append('film_name', filmName!);
      if (params.type) {
        const subdlType = params.type === 'episode' ? 'tv' : params.type === 'all' ? undefined : params.type;
        if (subdlType) fallbackUrl.searchParams.append('type', subdlType);
      }
      fallbackUrl.searchParams.append('subs_per_page', '30');
      fallbackUrl.searchParams.append('comment', '1');
      fallbackUrl.searchParams.append('releases', '1');
      const fallbackResp = await fetch(fallbackUrl.toString(), { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Origin: 'https://subdl.com', Referer: 'https://subdl.com/' } });
      let fallbackJson: any = {};
      try { fallbackJson = await fallbackResp.json(); } catch (e) { log.error(e, 'Failed to parse SubDL fallback JSON response'); }
      return fallbackJson as SubDLResponse;
    }
    return json as SubDLResponse;
  }
}

