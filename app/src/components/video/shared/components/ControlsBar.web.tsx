import React from 'react';

import { useTheme } from '../themes/ThemeProvider';
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
  const theme = useTheme();

  const progressPercent =
    playerState.duration > 0
      ? (playerState.currentTime / playerState.duration) * 100
      : 0;

  return (
    <div style={{ width: '100%' }}>
      {/* Progress Bar */}
      <div style={{ marginBottom: theme.dimensions.spacing }}>
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
            gap: theme.dimensions.spacing,
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
              color: theme.colors.text,
              fontSize: theme.dimensions.fontSize.small,
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
            gap: theme.dimensions.spacing,
          }}
        >
          {/* Subtitle button */}
          {controls.hasSubtitles && (
            <button
              style={{
                backgroundColor: theme.colors.surface,
                border: 'none',
                borderRadius: theme.styles.buttonRadius,
                color: theme.colors.text,
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: theme.dimensions.fontSize.small,
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
              backgroundColor: theme.colors.surface,
              border: 'none',
              borderRadius: theme.styles.buttonRadius,
              color: theme.colors.text,
              width: theme.dimensions.controlButton,
              height: theme.dimensions.controlButton,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={controls.toggleFullscreen}
          >
            <svg
              width={theme.dimensions.iconSize}
              height={theme.dimensions.iconSize}
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
