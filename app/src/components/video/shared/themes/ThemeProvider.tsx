import React, { createContext, useContext } from 'react';
import { defaultTheme } from './index';

// Always use default theme - no theme selection
const ThemeContext = createContext(defaultTheme);

export interface ThemeProviderProps {
  children: React.ReactNode;
}

// Simplified provider that always uses default theme
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={defaultTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return defaultTheme; // Always return default theme
};