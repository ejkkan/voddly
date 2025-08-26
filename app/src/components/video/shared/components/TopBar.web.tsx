import React from 'react';
import { useTheme } from '../themes/ThemeProvider';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ title, showBack, onBack }: TopBarProps) {
  const theme = useTheme();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.dimensions.spacing,
    }}>
      {showBack && (
        <button
          onClick={onBack}
          style={{
            backgroundColor: theme.colors.surface,
            border: 'none',
            borderRadius: theme.styles.buttonRadius,
            color: theme.colors.text,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: theme.dimensions.fontSize.medium,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back
        </button>
      )}
      {title && (
        <h2 style={{
          color: theme.colors.text,
          fontSize: theme.dimensions.fontSize.large,
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </h2>
      )}
    </div>
  );
}