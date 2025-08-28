import type {
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';

// Common query configurations
export const QUERY_CONFIGS = {
  // Short-lived data (user preferences, current session)
  SHORT_LIVED: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  // Medium-lived data (dashboard content, user data)
  MEDIUM_LIVED: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  // Long-lived data (metadata, static content)
  LONG_LIVED: {
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  // Never stale (configuration, constants)
  NEVER_STALE: {
    staleTime: Infinity,
    gcTime: Infinity,
  },
} as const;

// Helper to create standardized query options
export function createQueryOptions<TData, TError = Error>(
  config:
    | keyof typeof QUERY_CONFIGS
    | Partial<typeof QUERY_CONFIGS.MEDIUM_LIVED>,
  additionalOptions?: Partial<UseQueryOptions<TData, TError>>
): Partial<UseQueryOptions<TData, TError>> {
  const baseConfig =
    typeof config === 'string' ? QUERY_CONFIGS[config] : config;

  return {
    ...baseConfig,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...additionalOptions,
  };
}

// Helper to create standardized mutation options
export function createMutationOptions<TData, TVariables, TError = Error>(
  additionalOptions?: Partial<UseMutationOptions<TData, TError, TVariables>>
): Partial<UseMutationOptions<TData, TError, TVariables>> {
  return {
    retry: 1,
    retryDelay: 1000,
    ...additionalOptions,
  };
}

// Query key factory for consistent key structure
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => ['auth', 'session'] as const,
    user: (userId?: string) => ['auth', 'user', userId] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    previews: (limit?: number, accountId?: string | null) =>
      ['dashboard', 'previews', limit, accountId] as const,
    trends: {
      all: ['dashboard', 'trends'] as const,
      movie: (feed: string) => ['dashboard', 'trends', 'movie', feed] as const,
      series: (feed: string) => ['dashboard', 'trends', 'tv', feed] as const,
    },
  },
  favorites: {
    all: ['favorites'] as const,
    profile: (profileId: string) => ['favorites', profileId] as const,
  },
  sources: {
    all: ['sources'] as const,
    account: (accountId?: string) => ['sources', 'account', accountId] as const,
    profile: (profileId: string) => ['sources', 'profile', profileId] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    user: (userId?: string) => ['profiles', 'user', userId] as const,
  },
  playlists: {
    all: ['playlists'] as const,
    profile: (profileId: string) => ['playlists', profileId] as const,
  },
  metadata: {
    all: ['metadata'] as const,
    content: (
      type: string,
      tmdbId?: string | number,
      season?: number,
      episode?: number
    ) => ['metadata', type, tmdbId, season, episode] as const,
  },
  iptv: {
    all: ['iptv'] as const,
    catalog: (provider: string, sourceId?: string) =>
      ['iptv', provider, 'catalog', sourceId] as const,
  },
  player: {
    all: ['player'] as const,
    bundle: (profileId: string, contentUid: string) =>
      ['player', profileId, contentUid] as const,
  },
} as const;
