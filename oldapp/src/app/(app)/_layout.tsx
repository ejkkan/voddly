import React from 'react';
import { platformSelector } from '@/lib/platform';

// Platform-specific layout imports
const MobileLayout = React.lazy(() => import('./mobile.layout'));
const TVOSLayout = React.lazy(() => import('./tvos.layout'));
const WebLayout = React.lazy(() => import('./web.layout'));

// Select the appropriate layout based on platform
const LayoutComponent = platformSelector({
  tv: TVOSLayout,
  web: WebLayout,
  mobile: MobileLayout,
  default: MobileLayout,
});

export default function AppLayout() {
  return (
    <React.Suspense fallback={null}>
      <LayoutComponent />
    </React.Suspense>
  );
}
