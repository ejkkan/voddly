/* eslint-env node */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add tvOS platform support
config.resolver.platforms = ['ios', 'android', 'native', 'web', 'tvos'];

// Configure source extensions for tvOS-specific files
// Metro will resolve files in this order of preference:
// file.tvos.tsx → file.ios.tsx → file.native.tsx → file.tsx
config.resolver.sourceExts = [
  'tvos.js',
  'tvos.jsx',
  'tvos.ts',
  'tvos.tsx',
  ...config.resolver.sourceExts,
];

module.exports = withNativeWind(config, { input: './global.css' });
