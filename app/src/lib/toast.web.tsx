/* eslint-disable */
import React from 'react';
import { toast as sonnerToast, type ExternalToast } from 'sonner';

export type ToastLevel = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  description?: React.ReactNode;
  duration?: number;
  id?: string;
  dismissible?: boolean;
  action?: React.ReactNode;
  cancel?: React.ReactNode;
} & Omit<ExternalToast, 'description' | 'duration' | 'dismissible' | 'id'>;

function mapAndShow(level: ToastLevel, title: string, options?: ToastOptions) {
  const opts: any = { ...options };
  if (options?.description) opts.description = options.description;
  if (options?.duration != null) opts.duration = options.duration;
  if (options?.id) opts.id = options.id;
  if (options?.dismissible != null) opts.dismissible = options.dismissible;
  if (options?.action) opts.action = options.action as any;
  if (options?.cancel) opts.cancel = options.cancel as any;

  switch (level) {
    case 'success':
      return sonnerToast.success(title, opts);
    case 'error':
      return sonnerToast.error(title, opts);
    case 'warning':
      return sonnerToast(title, { ...opts, icon: '⚠️' });
    case 'info':
    default:
      return sonnerToast(title, opts);
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

export type { ExternalToast as WebToastOptions };
