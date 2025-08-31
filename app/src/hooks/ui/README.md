# UI Hooks with Route-Based Enabling

This document explains how to use the UI hooks with the new `enabled` flags and route focus tracking functionality.

## Overview

The UI hooks now support an `enabled` parameter that can be used to conditionally enable/disable queries based on the current route focus or other conditions. This helps optimize performance by only running queries when they're actually needed.

## Available Route Hooks

### Primary Hook: `useRouteFocus`

```typescript
import { useRouteFocus } from '@/hooks/ui/useRouteActive';

// Get current route info and focus status
const { name: routeName, current: isFocused } = useRouteFocus();

// Example usage:
if (isFocused && routeName.startsWith('/(app)/dashboard')) {
  // Dashboard is focused and active
  console.log('Dashboard is focused:', routeName);
}
```

### Legacy Route Checking Hooks

```typescript
import {
  useRouteActive,
  useIsDashboardRoute,
  useIsMoviesRoute,
  useIsSeriesRoute,
  useIsLiveRoute,
  useIsSearchRoute,
} from '@/hooks/ui/useRouteActive';

// Check if current route matches a path
const isActive = useRouteActive('/(app)/dashboard');

// Check specific routes
const isDashboard = useIsDashboardRoute();
const isMovies = useIsMoviesRoute();
const isSeries = useIsSeriesRoute();
const isLive = useIsLiveRoute();
const isSearch = useIsSearchRoute();
```

## Using with UI Sections

```typescript
import { useUiSections } from '@/hooks/ui/use-ui-catalog';
import { useRouteFocus } from '@/hooks/ui/useRouteActive';

// Only fetch sections when dashboard is focused
const { name: routeName, current: isFocused } = useRouteFocus();
const isDashboard = routeName.startsWith('/(app)/dashboard');

const { data, isLoading } = useUiSections('movie', {
  enabled: isFocused && isDashboard,
  limitPerCategory: 20,
  maxCategories: 10,
});
```

## Using with UI Preview

```typescript
import { useUiPreview } from '@/hooks/ui/use-ui-catalog';
import { useRouteFocus } from '@/hooks/ui/useRouteActive';

// Only fetch preview when movies route is focused
const { name: routeName, current: isFocused } = useRouteFocus();
const isMovies = routeName.startsWith('/(app)/movies');

const { data, isLoading } = useUiPreview('movie', 10, isFocused && isMovies);
```

## Using with Trends

```typescript
import { useDashboardTrends } from '@/hooks/ui/useDashboardTrends';
import { useRouteFocus } from '@/hooks/ui/useRouteActive';

// Only fetch trends when dashboard is focused
const { name: routeName, current: isFocused } = useRouteFocus();
const isDashboard = routeName.startsWith('/(app)/dashboard');

const { movies, series, isLoading } = useDashboardTrends(
  isFocused && isDashboard
);
```

## Benefits

1. **Performance**: Queries only run when the relevant route is focused
2. **Resource Management**: Reduces unnecessary API calls and database queries
3. **User Experience**: Faster navigation between routes
4. **Flexibility**: Can be combined with other conditions beyond just routes
5. **Focus Awareness**: Knows when routes are actually focused vs just navigated to

## Example: Conditional Loading with Focus

```typescript
function DashboardContent() {
  const { name: routeName, current: isFocused } = useRouteFocus();
  const isDashboard = routeName.startsWith('/(app)/dashboard');

  // These queries will only run when dashboard is focused
  const { data: movieSections } = useUiSections('movie', {
    enabled: isFocused && isDashboard,
    limitPerCategory: 20,
  });

  const { data: trends } = useDashboardTrends(isFocused && isDashboard);

  if (!isFocused || !isDashboard) {
    return null; // Don't render content if not focused or not on dashboard
  }

  return (
    <View>
      {/* Render dashboard content only when focused */}
    </View>
  );
}
```

## Route Focus vs Route Navigation

- **`current: true`** - Route is actively focused and visible
- **`current: false`** - Route is no longer focused (user navigated away)
- **`name`** - Current route path (e.g., `"/(app)/dashboard"`)

This distinction is useful for:

- **Lazy loading**: Only load data when route is focused
- **Cleanup**: Stop background operations when route loses focus
- **Performance**: Pause expensive operations on unfocused routes
- **User experience**: Show loading states only when relevant
