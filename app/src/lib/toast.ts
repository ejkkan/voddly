/* eslint-disable */
import { Platform } from 'react-native';

type AnyNotify = {
  success: (title: string, options?: any) => any;
  error: (title: string, options?: any) => any;
  info: (title: string, options?: any) => any;
  warning: (title: string, options?: any) => any;
};

// Defer requiring platform files so native builds don't pull web deps and vice versa
const impl: AnyNotify = Platform.select<any>({
  web: () => require('./toast.web').notify,
  default: () => require('./toast.native').notify,
})();

export const notify: AnyNotify = impl;
