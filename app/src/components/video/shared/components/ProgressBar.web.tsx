import React, { useRef } from 'react';
import { useTheme } from '../themes/ThemeProvider';

interface ProgressBarProps {
  progress: number;
  buffered?: number;
  onSeek: (fraction: number) => void;
  minimal?: boolean;
}

export function ProgressBar({ progress, buffered = 0, onSeek, minimal = false }: ProgressBarProps) {
  const theme = useTheme();
  const barRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, fraction)));
  };

  const height = minimal ? 2 : theme.dimensions.progressBarHeight;

  return (
    <div
      ref={barRef}
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        height,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: height / 2,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Buffered progress */}
      {buffered > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${buffered}%`,
            backgroundColor: theme.colors.buffered,
          }}
        />
      )}
      
      {/* Playback progress */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${progress}%`,
          backgroundColor: theme.colors.progress,
          transition: 'width 0.1s linear',
        }}
      />

      {/* Hover indicator */}
      {!minimal && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${progress}%`,
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            backgroundColor: theme.colors.progress,
            borderRadius: '50%',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          className="progress-handle"
        />
      )}

      <style>{`
        div:hover .progress-handle {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}