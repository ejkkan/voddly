'use client';

import type { IptvClient } from './clients/base';
import { M3UIptvClient } from './clients/m3u-client';
import { XtreamIptvClient } from './clients/xtream-adapter';

export type ProviderType = 'xtream' | 'm3u';

export function getIptvClient(
  provider: ProviderType,
  credentials: any
): IptvClient {
  switch (provider) {
    case 'xtream':
      return new XtreamIptvClient(credentials);
    case 'm3u':
      return new M3UIptvClient(credentials.server ?? credentials);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
