import { Platform } from 'react-native';

// @ts-ignore - tvOS is a valid platform but not in the type definitions
export const isTV = Platform.OS === 'tvos' || Platform.isTV;
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

export const platformSelector = <T>(options: {
  tv?: T;
  mobile?: T;
  ios?: T;
  android?: T;
  web?: T;
  default?: T;
}): T => {
  if (isTV && options.tv !== undefined) {
    return options.tv;
  }

  if (Platform.OS === 'ios' && options.ios !== undefined) {
    return options.ios;
  }

  if (Platform.OS === 'android' && options.android !== undefined) {
    return options.android;
  }

  if (isWeb && options.web !== undefined) {
    return options.web;
  }

  if (isMobile && options.mobile !== undefined) {
    return options.mobile;
  }

  if (options.default !== undefined) {
    return options.default;
  }

  throw new Error('No suitable platform option provided');
};
