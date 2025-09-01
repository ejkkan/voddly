import React from 'react';

import { NavigationLayout } from './NavigationLayout';

export function AppShell({ children }: { children: React.ReactNode }) {
  return <NavigationLayout>{children}</NavigationLayout>;
}
