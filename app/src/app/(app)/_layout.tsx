import React from 'react';
import { platformSelector } from '@/lib/platform';

// Platform-specific layout imports
const MobileLayout = React.lazy(() => import('./_layout.mobile'));
const TVOSLayout = React.lazy(() => import('./_layout.tvos'));
const WebLayout = React.lazy(() => import('./_layout.web'));

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
