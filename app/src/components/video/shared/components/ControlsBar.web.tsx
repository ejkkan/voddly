import React from 'react';

import { type PlayerControls, type PlayerState } from '../types/player.types';
import { formatTime } from '../utils/formatTime';
import { CastButton } from './CastButton';
import { PlayButton } from './PlayButton';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';

interface ControlsBarProps {
  playerState: PlayerState;
  controls: PlayerControls;
}

export function ControlsBar({ playerState, controls }: ControlsBarProps) {

  const progressPercent =
    playerState.duration > 0
      ? (playerState.currentTime / playerState.duration) * 100
      : 0;

  return (
    <div style={{ width: '100%' }}>
      {/* Progress Bar */}
      <div style={{ marginBottom: 12 }}>
        <ProgressBar
          progress={progressPercent}
          onSeek={(fraction) => controls.seek(fraction * playerState.duration)}
        />
      </div>

      {/* Controls Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <PlayButton
            isPlaying={playerState.isPlaying}
            onPress={controls.togglePlay}
          />
          <VolumeControl
            volume={playerState.volume}
            isMuted={playerState.isMuted}
            onVolumeChange={controls.setVolume}
            onToggleMute={controls.toggleMute}
          />
          <span
            style={{
              color: '#ffffff',
              fontSize: 14,
            }}
          >
            {formatTime(playerState.currentTime)} /{' '}
            {formatTime(playerState.duration)}
          </span>
        </div>

        {/* Right Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Subtitle button */}
          {controls.hasSubtitles && (
            <button
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 14,
              }}
              onClick={controls.onPressSubtitles}
            >
              CC
            </button>
          )}

          {/* Cast button */}
          {playerState.castState && (
            <CastButton
              castState={playerState.castState}
              onPress={() => {
                if (playerState.isCasting) {
                  controls.stopCast?.();
                } else {
                  controls.startCast?.();
                }
              }}
            />
          )}

          {/* Fullscreen button */}
          <button
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={controls.toggleFullscreen}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
