import React from 'react';
import { Redirect } from 'expo-router';

export default function AppIndex() {
  return <Redirect href="/(app)/dashboard" />;
}
