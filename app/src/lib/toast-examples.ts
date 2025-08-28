import { notify, toast, ToastPosition } from './toast';

// Basic toast examples
export const basicToastExamples = {
  // Success toast
  success: () => notify.success('Operation completed successfully!'),

  // Error toast
  error: () => notify.error('Something went wrong!'),

  // Info toast
  info: () => notify.info('Here is some information for you'),

  // Warning toast
  warning: () => notify.warning('Please be careful with this action'),
};

// Toast with custom duration
export const durationExamples = {
  short: () => notify.success('Quick message', { duration: 2000 }),
  long: () => notify.info('This will stay longer', { duration: 8000 }),
  default: () => notify.success('Default duration (4000ms)'),
};

// Toast with custom position
export const positionExamples = {
  top: () => notify.success('Top position', { position: ToastPosition.TOP }),
  bottom: () =>
    notify.error('Bottom position', { position: ToastPosition.BOTTOM }),
  center: () => notify.info('Center position', { position: ToastPosition.TOP }), // Using TOP as CENTER alternative
};

// Action-style toast with dismiss button
export const actionToastExamples = {
  dismissable: () =>
    notify.success('Action completed!', {
      action: {
        label: 'Dismiss',
        onPress: () => console.log('Toast dismissed'),
      },
    }),

  withCustomAction: () =>
    notify.info('New message received', {
      action: {
        label: 'View',
        onPress: () => console.log('Navigate to message'),
      },
      duration: 6000, // Give more time for user to interact
    }),

  errorWithRetry: () =>
    notify.error('Failed to load data', {
      action: {
        label: 'Retry',
        onPress: () => console.log('Retrying...'),
      },
      duration: 8000,
    }),
};

// Advanced toast examples using the raw toast function
export const advancedExamples = {
  // Promise toast
  promise: () => {
    const sleep = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.5) {
          resolve({ username: 'User' });
        } else {
          reject('Operation failed');
        }
      }, 2500);
    });

    toast.promise(
      sleep,
      {
        loading: 'Loading...',
        success: (data: any) => `Welcome ${data.username}!`,
        error: (err: any) => err.toString(),
      },
      {
        position: ToastPosition.BOTTOM,
      }
    );
  },

  // Loading toast with manual dismiss
  loading: () => {
    const id = toast.loading('Processing your request...');

    // Simulate some work
    setTimeout(() => {
      toast.dismiss(id);
      notify.success('Request completed!');
    }, 3000);
  },

  // Custom toast with description
  withDescription: () =>
    notify.info('Update available', {
      description: 'A new version is ready to install',
      duration: 5000,
    }),
};

// Usage examples for common scenarios
export const commonScenarios = {
  // Form submission
  formSuccess: () => notify.success('Form submitted successfully!'),
  formError: () => notify.error('Please check your input and try again'),

  // Network operations
  networkSuccess: () => notify.success('Data loaded successfully'),
  networkError: () =>
    notify.error('Network error. Please check your connection'),

  // User actions
  userAction: () =>
    notify.info('Action completed', {
      action: {
        label: 'Undo',
        onPress: () => console.log('Undoing action...'),
      },
    }),

  // Notifications
  notification: () =>
    notify.info('New notification', {
      description: 'You have a new message',
      action: {
        label: 'View',
        onPress: () => console.log('Opening notification...'),
      },
    }),
};

// Export all examples for easy access
export const allToastExamples = {
  ...basicToastExamples,
  ...durationExamples,
  ...positionExamples,
  ...actionToastExamples,
  ...advancedExamples,
  ...commonScenarios,
};
