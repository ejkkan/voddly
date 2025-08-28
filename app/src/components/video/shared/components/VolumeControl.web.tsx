import React, { useState } from 'react';

import { useTheme } from '../themes/ThemeProvider';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const theme = useTheme();
  const [showSlider, setShowSlider] = useState(false);

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
      }}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      {/* Mute button */}
      <button
        onClick={onToggleMute}
        style={{
          backgroundColor: theme.colors.surface,
          border: 'none',
          borderRadius: theme.styles.buttonRadius,
          width: theme.dimensions.controlButton,
          height: theme.dimensions.controlButton,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: theme.styles.buttonOpacity,
        }}
      >
        <svg
          width={theme.dimensions.iconSize}
          height={theme.dimensions.iconSize}
          viewBox="0 0 24 24"
          fill={theme.colors.text}
        >
          {isMuted || volume === 0 ? (
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          ) : volume < 0.5 ? (
            <path d="M7 9v6h4l5 5V4l-5 5H7z" />
          ) : (
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          )}
        </svg>
      </button>

      {/* Volume slider */}
      {showSlider && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            marginLeft: 8,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
            padding: '4px 8px',
            borderRadius: theme.styles.buttonRadius,
          }}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={effectiveVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{
              width: 80,
              height: 4,
              cursor: 'pointer',
            }}
          />
        </div>
      )}
    </div>
  );
}
