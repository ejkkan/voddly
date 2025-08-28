import React, { useMemo } from 'react';

import { themes } from './shared/themes';
import { type BasePlayerProps } from './shared/types/player.types';
import { getDefaultPlayer } from './shared/utils/platformHelpers';

// Lazy load players to reduce bundle size
const WebPlayer = React.lazy(() => import('./web-player/WebPlayer'));
const RNVideoPlayer = React.lazy(
  () => import('./rn-video-player/RNVideoPlayer')
);
const VLCPlayer = React.lazy(() => import('./vlc-player/VLCPlayer'));
const ExpoVideoPlayer = React.lazy(() => import('./ExpoVideoPlayerView'));

export interface VideoPlayerProps extends BasePlayerProps {
  preferredPlayer?: 'auto' | 'web' | 'rn-video' | 'vlc' | 'expo-video';
}

export function VideoPlayer({
  url,
  preferredPlayer = 'auto',
  layout = 'netflix',
  theme = 'default',
  ...props
}: VideoPlayerProps) {
  // Determine which player to use
  const selectedPlayer = useMemo(() => {
    if (preferredPlayer !== 'auto') {
      console.log('[VideoPlayer] Using preferred player:', preferredPlayer);
      return preferredPlayer;
    }
    const autoPlayer = getDefaultPlayer(url);
    console.log(
      '[VideoPlayer] Auto-selected player:',
      autoPlayer,
      'for URL:',
      url
    );
    return autoPlayer;
  }, [url, preferredPlayer]);

  console.log('[VideoPlayer] Final selected player:', selectedPlayer);
  // Resolve theme if string
  const resolvedTheme = typeof theme === 'string' ? themes[theme] : theme;
  console.log('[VideoPlayer] Theme:', theme, 'Resolved theme:', resolvedTheme);

  // Common props for all players
  const playerProps = {
    url,
    layout,
    theme: resolvedTheme,
    ...props,
  };

  // Render the appropriate player
  switch (selectedPlayer) {
    case 'web':
      return (
        <React.Suspense fallback={<div>Loading player...</div>}>
          <WebPlayer {...playerProps} />
        </React.Suspense>
      );

    case 'rn-video':
      return (
        <React.Suspense fallback={null}>
          <RNVideoPlayer {...playerProps} />
        </React.Suspense>
      );

    case 'vlc':
      return (
        <React.Suspense fallback={null}>
          <VLCPlayer {...playerProps} />
        </React.Suspense>
      );

    case 'expo-video':
      return (
        <React.Suspense fallback={null}>
          <ExpoVideoPlayer {...playerProps} />
        </React.Suspense>
      );

    default:
      // Fallback to RN Video for unknown players
      return (
        <React.Suspense fallback={null}>
          <RNVideoPlayer {...playerProps} />
        </React.Suspense>
      );
  }
}
