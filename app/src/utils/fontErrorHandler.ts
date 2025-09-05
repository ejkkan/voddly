// Global error handler for FontFaceObserver timeouts
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Suppress FontFaceObserver timeout errors
    if (
      event.message &&
      event.message.includes('timeout exceeded') &&
      event.filename &&
      event.filename.includes('fontfaceobserver')
    ) {
      event.preventDefault();
      console.warn('Font loading timeout - continuing without custom fonts');
      return false;
    }
  });

  // Also handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      event.reason.message &&
      event.reason.message.includes('timeout exceeded')
    ) {
      event.preventDefault();
      console.warn('Font loading timeout - continuing without custom fonts');
      return false;
    }
  });
}

export {};
