import React from 'react';
import { platformSelector } from '@/lib/platform';

// Platform-specific imports
const OnboardingMobile = React.lazy(() => import('./onboarding.mobile'));
const OnboardingTVOS = React.lazy(() => import('./onboarding.tvos'));
const OnboardingWeb = React.lazy(() => import('./onboarding.web'));

// Select the appropriate onboarding component based on platform
const OnboardingComponent = platformSelector({
  tv: OnboardingTVOS,
  web: OnboardingWeb,
  mobile: OnboardingMobile,
  default: OnboardingMobile,
});

export default function Onboarding() {
  return (
    <React.Suspense fallback={null}>
      <OnboardingComponent />
    </React.Suspense>
  );
}
