import type { Theme } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';

import colors from '@/components/ui/colors';

const DarkTheme: Theme = {
  dark: true,
  colors: {
    primary: colors.primary[200],
    background: colors.charcoal[950],
    card: colors.charcoal[850],
    text: colors.charcoal[100],
    border: colors.charcoal[500],
    notification: colors.primary[200],
  },
};

const LightTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary[400],
    background: colors.white,
    card: colors.white,
    text: colors.charcoal[900],
    border: colors.charcoal[200],
    notification: colors.primary[400],
  },
};

export function useThemeConfig() {
  const { colorScheme } = useColorScheme();

  if (colorScheme === 'dark') return DarkTheme;

  return LightTheme;
}
