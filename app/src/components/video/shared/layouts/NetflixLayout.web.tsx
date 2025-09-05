import React from 'react';

import { ControlsBar } from '../components/ControlsBar.web';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { TopBar } from '../components/TopBar';
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
  constrainToContainer = true,
}: PlayerLayoutProps) {

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

      {/* Bottom Controls and Info with gradient */}
      {showControls && (
        <div
          style={{
            position: constrainToContainer ? 'absolute' : 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            padding: 16,
            animation: 'fadeIn 200ms ease-in',
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          {/* Video Info at bottom */}
          <div style={{ marginBottom: 12 }}>
            <TopBar title={title} showBack={showBack} onBack={onBack} />
          </div>
          {/* Controls below the info */}
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
