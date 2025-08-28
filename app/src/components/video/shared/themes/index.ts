import { type VisualTheme } from '../types/theme.types';
import { compactTheme } from './compact.theme';
import { defaultTheme } from './default.theme';

export { compactTheme } from './compact.theme';
export { defaultTheme } from './default.theme';
export type { ThemeProviderProps } from './ThemeProvider';
export { ThemeProvider, useTheme } from './ThemeProvider';

export const themes: Record<string, VisualTheme> = {
  default: defaultTheme,
  compact: compactTheme,
};
