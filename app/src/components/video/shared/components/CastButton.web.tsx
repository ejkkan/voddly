import React, { useEffect, useState } from 'react';

import { useTheme } from '../themes/ThemeProvider';
import { type CastState } from '../types/player.types';

interface CastButtonProps {
  castState: CastState;
  onPress: () => void;
}

export function CastButton({ castState, onPress }: CastButtonProps) {
  const theme = useTheme();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Check if Cast API is available
    const checkCastAvailability = () => {
      if (window.chrome && window.chrome.cast) {
        setIsAvailable(true);
      }
    };

    // Check immediately
    checkCastAvailability();

    // Also check when Cast API loads
    window['__onGCastApiAvailable'] = (isAvailable: boolean) => {
      setIsAvailable(isAvailable);
    };

    // Load Cast API if not loaded
    if (!document.getElementById('cast-api-script')) {
      const script = document.createElement('script');
      script.id = 'cast-api-script';
      script.src =
        'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      document.head.appendChild(script);
    }
  }, []);

  if (!isAvailable || castState === 'NO_DEVICES_AVAILABLE') {
    return null;
  }

  const getIconColor = () => {
    switch (castState) {
      case 'CONNECTED':
        return theme.colors.progress; // Green when connected
      case 'CONNECTING':
        return theme.colors.textSecondary; // Gray when connecting
      default:
        return theme.colors.text; // White when available
    }
  };

  return (
    <button
      onClick={onPress}
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
        transition: 'opacity 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.opacity = String(theme.styles.buttonOpacity))
      }
      title={castState === 'CONNECTED' ? 'Stop casting' : 'Cast to device'}
    >
      <svg
        width={theme.dimensions.iconSize}
        height={theme.dimensions.iconSize}
        viewBox="0 0 24 24"
        fill={getIconColor()}
      >
        {/* Cast icon */}
        <path d="M21 3H3c-1.11 0-2 .89-2 2v3h2V5h18v14h-7v2h7c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />

        {/* Show connecting animation */}
        {castState === 'CONNECTING' && (
          <circle
            cx="12"
            cy="12"
            r="3"
            fill="none"
            stroke={getIconColor()}
            strokeWidth="2"
          >
            <animate
              attributeName="opacity"
              values="1;0;1"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* Connected indicator dot */}
      {castState === 'CONNECTED' && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: theme.colors.progress,
          }}
        />
      )}
    </button>
  );
}
