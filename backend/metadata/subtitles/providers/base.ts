import {
  type SubtitleProvider,
  type SubtitleSearchParams,
  type SubtitleMetadata,
  type SubtitleLanguage,
} from '../types';

export abstract class BaseSubtitleProvider implements SubtitleProvider {
  abstract name: string;

  abstract searchSubtitles(
    params: SubtitleSearchParams
  ): Promise<SubtitleMetadata[]>;
  abstract downloadSubtitle(
    subtitleId: string,
    metadata: SubtitleMetadata
  ): Promise<string>;
  abstract getAvailableLanguages(
    params: SubtitleSearchParams
  ): Promise<SubtitleLanguage[]>;

  protected getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
      nl: 'Dutch',
      sv: 'Swedish',
      da: 'Danish',
      no: 'Norwegian',
      fi: 'Finnish',
      pl: 'Polish',
      cs: 'Czech',
      hu: 'Hungarian',
      el: 'Greek',
      he: 'Hebrew',
      th: 'Thai',
      tr: 'Turkish',
      uk: 'Ukrainian',
      bg: 'Bulgarian',
      hr: 'Croatian',
      ro: 'Romanian',
      sk: 'Slovak',
      sl: 'Slovenian',
      et: 'Estonian',
      lv: 'Latvian',
      lt: 'Lithuanian',
      mt: 'Maltese',
      ms: 'Malay',
      id: 'Indonesian',
    };
    return languageNames[code] || code.toUpperCase();
  }
}

