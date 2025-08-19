/* eslint-env node */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add wasm asset support for expo-sqlite (web)
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// Add COEP and COOP headers to support SharedArrayBuffer in web (required by expo-sqlite wasm)
config.server = config.server || {};
const existingEnhancer = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware) => {
  const base = existingEnhancer ? existingEnhancer(middleware) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    base(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './global.css' });
