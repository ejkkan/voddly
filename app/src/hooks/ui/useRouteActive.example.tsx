import React from 'react';
import { Text, View } from 'react-native';

import { useRouteFocus } from './useRouteActive';

/**
 * Example component showing how to use the useRouteFocus hook
 * This component will only render content when its route is focused
 */
export function RouteFocusExample() {
  const { name: routeName, current: isFocused } = useRouteFocus();

  // Determine which route we're on
  const isDashboard = routeName.startsWith('/(app)/dashboard');
  const isMovies = routeName.startsWith('/(app)/movies');
  const isSeries = routeName.startsWith('/(app)/series');
  const isLive = routeName.startsWith('/(app)/tv');

  // Only render content when focused
  if (!isFocused) {
    return (
      <View style={{ padding: 16, backgroundColor: '#f0f0f0' }}>
        <Text>Route not focused: {routeName}</Text>
      </View>
    );
  }

  // Render different content based on route
  if (isDashboard) {
    return (
      <View style={{ padding: 16, backgroundColor: '#e8f5e8' }}>
        <Text style={{ fontWeight: 'bold' }}>Dashboard (Focused)</Text>
        <Text>Route: {routeName}</Text>
        <Text>Status: Active and focused</Text>
      </View>
    );
  }

  if (isMovies) {
    return (
      <View style={{ padding: 16, backgroundColor: '#e8f0f8' }}>
        <Text style={{ fontWeight: 'bold' }}>Movies (Focused)</Text>
        <Text>Route: {routeName}</Text>
        <Text>Status: Active and focused</Text>
      </View>
    );
  }

  if (isSeries) {
    return (
      <View style={{ padding: 16, backgroundColor: '#f8e8f0' }}>
        <Text style={{ fontWeight: 'bold' }}>Series (Focused)</Text>
        <Text>Route: {routeName}</Text>
        <Text>Status: Active and focused</Text>
      </View>
    );
  }

  if (isLive) {
    return (
      <View style={{ padding: 16, backgroundColor: '#f8f8e8' }}>
        <Text style={{ fontWeight: 'bold' }}>Live (Focused)</Text>
        <Text>Route: {routeName}</Text>
        <Text>Status: Active and focused</Text>
      </View>
    );
  }

  // Unknown route
  return (
    <View style={{ padding: 16, backgroundColor: '#f0f0f0' }}>
      <Text style={{ fontWeight: 'bold' }}>Unknown Route</Text>
      <Text>Route: {routeName}</Text>
      <Text>Status: Active and focused</Text>
    </View>
  );
}

/**
 * Example of using useRouteFocus with conditional data fetching
 */
export function ConditionalDataExample() {
  const { name: routeName, current: isFocused } = useRouteFocus();
  const isDashboard = routeName.startsWith('/(app)/dashboard');

  // Example of conditional data fetching
  const shouldFetchData = isFocused && isDashboard;

  return (
    <View style={{ padding: 16, backgroundColor: '#f8f8f8' }}>
      <Text style={{ fontWeight: 'bold' }}>Conditional Data Fetching</Text>
      <Text>Route: {routeName}</Text>
      <Text>Focused: {isFocused ? 'Yes' : 'No'}</Text>
      <Text>Dashboard: {isDashboard ? 'Yes' : 'No'}</Text>
      <Text>Should Fetch: {shouldFetchData ? 'Yes' : 'No'}</Text>

      {/* In real usage, you would use this with your data hooks: */}
      {/* 
      const { data, isLoading } = useDashboardTrends(shouldFetchData);
      const { data: sections } = useUiSections('movie', {
        enabled: shouldFetchData,
        limitPerCategory: 20
      });
      */}
    </View>
  );
}
