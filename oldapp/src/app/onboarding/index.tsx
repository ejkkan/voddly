import React from 'react';

// Use React Native's platform resolution by importing the same module name.
// Metro will pick onboarding.ios/android/tvos/web automatically, with
// onboarding.tsx as a fallback.
const OnboardingComponent = React.lazy(() => import('./onboarding'));

export default function Onboarding() {
  return (
    <React.Suspense fallback={null}>
      <OnboardingComponent />
    </React.Suspense>
  );
}
