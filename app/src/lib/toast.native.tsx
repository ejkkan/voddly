/* eslint-disable */
import { Alert } from 'react-native';

export type ToastLevel = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  id?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

function showAlert(level: ToastLevel, title: string, options?: ToastOptions) {
  const buttons: Array<{
    text: string;
    onPress?: () => void;
    style?: 'cancel' | 'destructive' | 'default';
  }> = [];
  if (options?.cancelLabel || options?.onCancel) {
    buttons.push({
      text: options?.cancelLabel || 'Close',
      onPress: options?.onCancel,
      style: 'cancel',
    });
  }
  if (options?.actionLabel || options?.onAction) {
    buttons.push({
      text: options?.actionLabel || 'OK',
      onPress: options?.onAction,
    });
  }
  if (buttons.length === 0) {
    buttons.push({ text: 'OK' });
  }
  Alert.alert(title, undefined, buttons, { cancelable: true });
}

export const notify = Object.freeze({
  success: (title: string, options?: ToastOptions) =>
    showAlert('success', title, options),
  error: (title: string, options?: ToastOptions) =>
    showAlert('error', title, options),
  info: (title: string, options?: ToastOptions) =>
    showAlert('info', title, options),
  warning: (title: string, options?: ToastOptions) =>
    showAlert('warning', title, options),
});
