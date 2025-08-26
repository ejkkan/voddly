import React, { createContext, useContext } from 'react';
import { VisualTheme } from '../types/theme.types';
import { defaultTheme } from './default.theme';

const ThemeContext = createContext<VisualTheme>(defaultTheme);

export interface ThemeProviderProps {
  theme: VisualTheme;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme, children }) => {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
};