/* eslint-disable */
import { toast as backpackToast, ToastPosition } from '@backpackapp-io/react-native-toast';

export type ToastLevel = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  description?: string;
  duration?: number;
  id?: string;
  dismissible?: boolean;
  action?: {
    label: string;
    onPress: () => void;
  };
  position?: ToastPosition;
};

function mapAndShow(level: ToastLevel, title: string, options?: ToastOptions) {
  const opts: any = {};
  
  if (options?.description) opts.description = options.description;
  if (options?.duration != null) opts.duration = options.duration;
  if (options?.id) opts.id = options.id;
  if (options?.dismissible != null) opts.dismissible = options.dismissible;
  if (options?.position) opts.position = options.position;

  // Handle action-style toast with dismiss button
  if (options?.action) {
    opts.action = {
      label: options.action.label,
      onPress: options.action.onPress,
    };
  }

  switch (level) {
    case 'success':
      return backpackToast.success(title, opts);
    case 'error':
      return backpackToast.error(title, opts);
    case 'warning':
      return backpackToast(title, { ...opts, icon: '⚠️' });
    case 'info':
    default:
      return backpackToast(title, opts);
  }
}

export const notify = Object.freeze({
  success: (title: string, options?: ToastOptions) =>
    mapAndShow('success', title, options),
  error: (title: string, options?: ToastOptions) =>
    mapAndShow('error', title, options),
  info: (title: string, options?: ToastOptions) =>
    mapAndShow('info', title, options),
  warning: (title: string, options?: ToastOptions) =>
    mapAndShow('warning', title, options),
});

// Export the raw toast function for advanced usage
export { backpackToast as toast };

// Export ToastPosition as a value so it can be used in examples
export { ToastPosition };
