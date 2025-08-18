import React from 'react';
import { isTV, isWeb, isMobile } from './platform';

// Component-specific platform selector
export const PlatformSelect: React.FC<{
  mobile?: React.ReactNode;
  tv?: React.ReactNode;
  web?: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ mobile, tv, web, fallback = null }) => {
  if (isTV && tv !== undefined) {
    return <>{tv}</>;
  }
  if (isWeb && web !== undefined) {
    return <>{web}</>;
  }
  if (isMobile && !isTV && mobile !== undefined) {
    return <>{mobile}</>;
  }
  return <>{fallback}</>;
};
