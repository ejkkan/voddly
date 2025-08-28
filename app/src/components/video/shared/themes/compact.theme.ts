import { type VisualTheme } from '../types/theme.types';

export const compactTheme: VisualTheme = {
  name: 'compact',

  dimensions: {
    controlButton: 36, // Smaller buttons
    iconSize: 16, // Smaller icons
    fontSize: {
      small: 10,
      medium: 12,
      large: 14,
    },
    spacing: 8, // Tighter spacing
    padding: 12, // Less padding
    progressBarHeight: 2, // Thinner progress bar
  },

  colors: {
    primary: '#ffffff',
    background: 'rgba(0, 0, 0, 0.6)',
    surface: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    progress: '#22c55e',
    buffered: 'rgba(255, 255, 255, 0.3)',
  },

  styles: {
    buttonRadius: 4,
    buttonOpacity: 1,
    controlsOpacity: 1,
  },

  animations: {
    fadeInDuration: 150,
    fadeOutDuration: 200,
    autoHideDelay: 2500, // Hide controls faster
  },
};
