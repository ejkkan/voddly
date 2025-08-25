/* eslint-disable */
import React from 'react';
import { Platform } from 'react-native';

export function AppToasterHost() {
  if (Platform.OS === 'web') {
    const { AppToasterHost: WebHost } = require('./toaster.web');
    return <WebHost />;
  }
  return null;
}
