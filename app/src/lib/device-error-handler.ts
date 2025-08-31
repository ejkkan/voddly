import { router } from 'expo-router';

import { notify } from '@/lib/toast';

interface DeviceError {
  code?: string;
  message?: string;
  details?: {
    deviceCount?: number;
    maxDevices?: number;
  };
}

/**
 * Handle device-related errors and show appropriate toasts
 */
export function handleDeviceError(error: any) {
  // Check if it's a device limit error from the API
  if (error?.code === 'forbidden' || error?.status === 403) {
    const message = error?.message || error?.details?.message || '';

    // Check if it's specifically a device limit error
    if (
      message.includes('Device limit exceeded') ||
      message.includes('device limit')
    ) {
      // Extract device count info if available
      const deviceMatch = message.match(/(\d+)\s+devices.*?(\d+)\s+allowed/);
      const currentDevices = deviceMatch?.[1];
      const maxDevices = deviceMatch?.[2];

      notify.error('Device Limit Reached', {
        description:
          currentDevices && maxDevices
            ? `You have ${currentDevices} of ${maxDevices} devices registered. Remove a device to continue.`
            : 'Maximum number of devices reached. Please remove a device to continue.',
        duration: 8000,
        action: {
          label: 'Manage Devices',
          onPress: () => {
            // Navigate to device management screen
            router.push('/settings/devices');
          },
        },
      });
      return true;
    }

    // Device not registered error
    if (
      message.includes('Device not registered') ||
      message.includes('device not found')
    ) {
      notify.warning('Device Not Registered', {
        description:
          'This device needs to be registered. Please enter your passphrase.',
        duration: 6000,
        action: {
          label: 'Register',
          onPress: () => {
            // Navigate to device registration or trigger passphrase modal
            router.push('/device-setup');
          },
        },
      });
      return true;
    }
  }

  return false;
}

/**
 * Global error interceptor for API calls
 * Wraps API calls to handle device errors automatically
 */
export function withDeviceErrorHandling<
  T extends (...args: any[]) => Promise<any>,
>(apiCall: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await apiCall(...args);
    } catch (error) {
      // Try to handle device error
      const handled = handleDeviceError(error);

      // If not a device error, re-throw
      if (!handled) {
        throw error;
      }

      // Return a rejected promise with the error for proper error handling
      return Promise.reject(error);
    }
  }) as T;
}

/**
 * React Query error handler for device errors
 * Use this in your queryClient configuration
 */
export function queryErrorHandler(error: any) {
  const handled = handleDeviceError(error);

  // If not a device error, you can handle other errors here
  if (!handled && error?.message) {
    // Only show generic errors for non-device related issues
    if (
      !error.message.includes('Device') &&
      !error.message.includes('device')
    ) {
      notify.error('Error', {
        description: error.message,
        duration: 5000,
      });
    }
  }
}
