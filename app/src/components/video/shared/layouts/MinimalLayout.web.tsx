import React from 'react';

import { LoadingOverlay } from '../components/LoadingOverlay';
import { PlayButton } from '../components/PlayButton';
import { ProgressBar } from '../components/ProgressBar';
import { useTheme } from '../themes/ThemeProvider';
import { type PlayerLayoutProps } from '../types/player.types';

export function MinimalLayout({
  videoElement,
  playerState,
  controls,
  showControls,
  setShowControls,
  constrainToContainer = true,
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

      {/* Minimal progress bar always visible at bottom */}
      <div
        style={{
          position: constrainToContainer ? 'absolute' : 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 2px',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <ProgressBar
          progress={(playerState.currentTime / playerState.duration) * 100}
          onSeek={(fraction) => controls.seek(fraction * playerState.duration)}
          minimal
        />
      </div>

      {/* Center play/pause button when controls shown */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '50%',
            padding: theme.dimensions.padding,
            animation: `fadeIn ${theme.animations.fadeInDuration}ms ease-in`,
          }}
        >
          <PlayButton
            isPlaying={playerState.isPlaying}
            onPress={controls.togglePlay}
            size="large"
          />
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
