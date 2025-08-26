import React, { useMemo } from 'react';
import { BasePlayerProps } from './shared/types/player.types';
import { getDefaultPlayer } from './shared/utils/platformHelpers';
import { themes } from './shared/themes';

// Lazy load players to reduce bundle size
const WebPlayer = React.lazy(() => import('./web-player/WebPlayer'));
const RNVideoPlayer = React.lazy(() => import('./rn-video-player/RNVideoPlayer'));
const VLCPlayer = React.lazy(() => import('./vlc-player/VLCPlayer'));

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
      return preferredPlayer;
    }
    return getDefaultPlayer(url);
  }, [url, preferredPlayer]);

  // Resolve theme if string
  const resolvedTheme = typeof theme === 'string' ? themes[theme] : theme;

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
    
    default:
      // Fallback to RN Video for unknown players
      return (
        <React.Suspense fallback={null}>
          <RNVideoPlayer {...playerProps} />
        </React.Suspense>
      );
  }
}