import React from 'react';

import { ControlsBar } from '../components/ControlsBar';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../themes/ThemeProvider';
import { type PlayerLayoutProps } from '../types/player.types';

export function NetflixLayout({
  videoElement,
  playerState,
  controls,
  title,
  showBack,
  onBack,
  showControls,
  setShowControls,
}: PlayerLayoutProps) {
  const theme = useTheme();

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
      }}
    >
      {/* Video Element */}
      <div
        style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        onClick={() => setShowControls(!showControls)}
      >
        {videoElement}
      </div>

      {/* Top Bar with gradient */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            padding: theme.dimensions.padding,
            animation: `fadeIn ${theme.animations.fadeInDuration}ms ease-in`,
          }}
        >
          <TopBar title={title} showBack={showBack} onBack={onBack} />
        </div>
      )}

      {/* Bottom Controls with gradient */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
            padding: theme.dimensions.padding,
            animation: `fadeIn ${theme.animations.fadeInDuration}ms ease-in`,
          }}
        >
          <ControlsBar playerState={playerState} controls={controls} />
        </div>
      )}

      {/* Loading Overlay */}
      {playerState.isLoading && <LoadingOverlay />}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
