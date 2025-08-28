// Theme system types

export interface VisualTheme {
  name: string;

  // Sizing
  dimensions: {
    controlButton: number; // Button size in pixels
    iconSize: number; // Icon size in pixels
    fontSize: {
      small: number;
      medium: number;
      large: number;
    };
    spacing: number; // Space between elements
    padding: number; // Container padding
    progressBarHeight: number;
  };

  // Colors
  colors: {
    primary: string; // Primary action color
    background: string; // Control background
    surface: string; // Button background
    text: string; // Primary text
    textSecondary: string; // Secondary text
    progress: string; // Progress bar fill
    buffered: string; // Buffered progress
  };

  // Styles
  styles: {
    buttonRadius: number; // Border radius for buttons
    buttonOpacity: number; // Button background opacity
    controlsOpacity: number; // Controls container opacity
  };

  // Animations
  animations: {
    fadeInDuration: number; // Controls fade in (ms)
    fadeOutDuration: number; // Controls fade out (ms)
    autoHideDelay: number; // Auto-hide after inactivity (ms)
  };
}
