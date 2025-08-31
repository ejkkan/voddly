import { useFocusEffect as useNavigationFocusEffect } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

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
  console.log('useRouteActive', pathname, path, exact);
  if (exact) {
    return pathname === path;
  }

  return pathname.startsWith(path);
};

/**
 * Hook to check if the current route is the dashboard
 * This hook is memoized to prevent infinite loops
 */
export const useIsDashboardRoute = (): boolean => {
  const pathname = usePathname();

  return useMemo(() => {
    return pathname.startsWith('/dashboard');
  }, [pathname]);
};

/**
 * Hook to check if the current route is the movies section
 * This hook is memoized to prevent infinite loops
 */
export const useIsMoviesRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/movies');
  }, [pathname]);
};

/**
 * Hook to check if the current route is the series section
 * This hook is memoized to prevent infinite loops
 */
export const useIsSeriesRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/series');
  }, [pathname]);
};

/**
 * Hook to check if the current route is the live section
 * This hook is memoized to prevent infinite loops
 */
export const useIsLiveRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/tv');
  }, [pathname]);
};

/**
 * Hook to check if the current route is the search section
 * This hook is memoized to prevent infinite loops
 */
export const useIsSearchRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/search');
  }, [pathname]);
};

/**
 * Hook to check if the current route is the favorites section
 * This hook is memoized to prevent infinite loops
 */
export const useIsFavoritesRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/favorites');
  }, [pathname]);
};

export const useIsPlaylistRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/playlists');
  }, [pathname]);
};

export const useIsProfileRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/profiles');
  }, [pathname]);
};

export const useIsSettingsRoute = (): boolean => {
  const pathname = usePathname();
  return useMemo(() => {
    return pathname.startsWith('/settings');
  }, [pathname]);
};
