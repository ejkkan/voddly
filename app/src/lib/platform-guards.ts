import { Platform } from 'react-native';
import { isTV, isMobile, isWeb } from './platform';

// Runtime platform check with warning
export function requirePlatform(
  platform: 'mobile' | 'tvos' | 'web',
  componentName?: string
) {
  const context = componentName ? ` in ${componentName}` : '';
  
  if (platform === 'mobile' && (!isMobile || isTV)) {
    console.warn(`This code requires mobile platform${context}`);
    return false;
  }
  
  if (platform === 'tvos' && !isTV) {
    console.warn(`This code requires tvOS platform${context}`);
    return false;
  }
  
  if (platform === 'web' && !isWeb) {
    console.warn(`This code requires web platform${context}`);
    return false;
  }
  
  return true;
}

// HOC to wrap components with platform checks
export function withPlatformCheck<P extends object>(
  platform: 'mobile' | 'tvos' | 'web',
  Component: React.ComponentType<P>
) {
  const WrappedComponent = (props: P) => {
    if (!requirePlatform(platform, Component.displayName || Component.name)) {
      return null;
    }
    return <Component {...props} />;
  };
  
  WrappedComponent.displayName = `withPlatformCheck(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Safe platform-specific imports
export function safePlatformImport<T>(
  platform: 'mobile' | 'tvos' | 'web',
  importFn: () => T
): T | null {
  if (
    (platform === 'mobile' && isMobile && !isTV) ||
    (platform === 'tvos' && isTV) ||
    (platform === 'web' && isWeb)
  ) {
    try {
      return importFn();
    } catch (error) {
      console.warn(`Failed to import platform-specific module for ${platform}:`, error);
      return null;
    }
  }
  return null;
}
