import React from 'react';
import { platformSelector } from '@/lib/platform';

// Platform-specific imports
const SignupMobile = React.lazy(() => import('./signup.mobile'));
const SignupTVOS = React.lazy(() => import('./signup.tvos'));
const SignupWeb = React.lazy(() => import('./signup.web'));

// Select the appropriate signup component based on platform
const SignupComponent = platformSelector({
  tv: SignupTVOS,
  web: SignupWeb,
  mobile: SignupMobile,
  default: SignupMobile,
});

export default function Signup() {
  return (
    <React.Suspense fallback={null}>
      <SignupComponent />
    </React.Suspense>
  );
}
