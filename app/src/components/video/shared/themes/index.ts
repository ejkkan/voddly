export { defaultTheme } from './default.theme';
export { compactTheme } from './compact.theme';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemeProviderProps } from './ThemeProvider';

import { defaultTheme } from './default.theme';
import { compactTheme } from './compact.theme';
import { VisualTheme } from '../types/theme.types';

export const themes: Record<string, VisualTheme> = {
  default: defaultTheme,
  compact: compactTheme,
};