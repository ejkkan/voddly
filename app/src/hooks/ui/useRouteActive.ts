import { useFocusEffect as useNavigationFocusEffect } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useCallback, useState } from 'react';

export type RouteFocusInfo = {
  name: string;
  current: boolean;
};

/**
 * Hook to track route focus and return current route information
 * @returns Object with route name and current focus status
 */
export const useRouteFocus = (): RouteFocusInfo => {
  const pathname = usePathname();
  const [focusInfo, setFocusInfo] = useState<RouteFocusInfo>({
    name: pathname,
    current: true,
  });

  useNavigationFocusEffect(
    useCallback(() => {
      // Route is focused
      setFocusInfo({
        name: pathname,
        current: true,
      });

      return () => {
        // Route is unfocused
        setFocusInfo({
          name: pathname,
          current: false,
        });
      };
    }, [pathname])
  );

  return focusInfo;
};

/**
 * Hook to check if the current route matches a given path
 * @param path - The path to check against (can be exact or partial)
 * @param exact - Whether to require an exact match (default: false)
 * @returns boolean indicating if the route is active
 */
export const useRouteActive = (path: string, exact = false): boolean => {
  const pathname = usePathname();

  if (exact) {
    return pathname === path;
  }

  return pathname.startsWith(path);
};

/**
 * Hook to check if the current route is the dashboard
 */
export const useIsDashboardRoute = (): boolean => {
  return useRouteActive('/dashboard');
};

/**
 * Hook to check if the current route is the movies section
 */
export const useIsMoviesRoute = (): boolean => {
  return useRouteActive('/movies');
};

/**
 * Hook to check if the current route is the series section
 */
export const useIsSeriesRoute = (): boolean => {
  return useRouteActive('/series');
};

/**
 * Hook to check if the current route is the live section
 */
export const useIsLiveRoute = (): boolean => {
  return useRouteActive('/live');
};

/**
 * Hook to check if the current route is the search section
 */
export const useIsSearchRoute = (): boolean => {
  return useRouteActive('/search');
};
