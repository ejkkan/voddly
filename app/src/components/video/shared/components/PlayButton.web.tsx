import React from 'react';

import { useTheme } from '../themes/ThemeProvider';

interface PlayButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function PlayButton({
  isPlaying,
  onPress,
  size = 'medium',
}: PlayButtonProps) {
  const theme = useTheme();

  const sizeMap = {
    small: theme.dimensions.controlButton * 0.8,
    medium: theme.dimensions.controlButton,
    large: theme.dimensions.controlButton * 1.5,
  };

  const iconSizeMap = {
    small: theme.dimensions.iconSize * 0.8,
    medium: theme.dimensions.iconSize,
    large: theme.dimensions.iconSize * 1.5,
  };

  const buttonSize = sizeMap[size];
  const iconSize = iconSizeMap[size];

  return (
    <button
      onClick={onPress}
      style={{
        backgroundColor: theme.colors.surface,
        border: 'none',
        borderRadius: theme.styles.buttonRadius,
        width: buttonSize,
        height: buttonSize,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: theme.styles.buttonOpacity,
        transition: 'opacity 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.opacity = String(theme.styles.buttonOpacity))
      }
    >
      {isPlaying ? (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill={theme.colors.text}
        >
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill={theme.colors.text}
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
