import { type VisualTheme } from '../types/theme.types';

export const defaultTheme: VisualTheme = {
  name: 'default',

  dimensions: {
    controlButton: 44,
    iconSize: 20,
    fontSize: {
      small: 12,
      medium: 14,
      large: 16,
    },
    spacing: 12,
    padding: 16,
    progressBarHeight: 4,
  },

  colors: {
    primary: '#ffffff',
    background: 'rgba(0, 0, 0, 0.7)',
    surface: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    progress: '#22c55e',
    buffered: 'rgba(255, 255, 255, 0.3)',
  },

  styles: {
    buttonRadius: 6,
    buttonOpacity: 1,
    controlsOpacity: 1,
  },

  animations: {
    fadeInDuration: 200,
    fadeOutDuration: 300,
    autoHideDelay: 3000,
  },
};
