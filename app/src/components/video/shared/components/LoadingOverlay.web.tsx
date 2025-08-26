import React from 'react';
import { useTheme } from '../themes/ThemeProvider';

export function LoadingOverlay() {
  const theme = useTheme();

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${theme.colors.surface}`,
          borderTopColor: theme.colors.progress,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}