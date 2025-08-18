import React from 'react';
import { platformSelector, isTV, isWeb } from '@/lib/platform';

// Platform-specific imports
const LoginMobile = React.lazy(() => import('./login.mobile'));
const LoginTVOS = React.lazy(() => import('./login.tvos'));
const LoginWeb = React.lazy(() => import('./login.web'));

// Select the appropriate login component based on platform
const LoginComponent = platformSelector({
  tv: LoginTVOS,
  web: LoginWeb,
  mobile: LoginMobile,
  default: LoginMobile,
});

export default function Login() {
  return (
    <React.Suspense fallback={null}>
      <LoginComponent />
    </React.Suspense>
  );
}
