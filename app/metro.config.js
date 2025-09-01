/* eslint-env node */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add platform-specific resolver configuration
config.resolver.platforms = ['native', 'web', 'ios', 'android'];

// Add wasm asset support for expo-sqlite (web)
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// Add json support for Lottie animations
if (!config.resolver.assetExts.includes('json')) {
  config.resolver.assetExts.push('json');
}

// Add COEP and COOP headers to support SharedArrayBuffer in web (required by expo-sqlite wasm)
config.server = config.server || {};
config.server.rewriteRequestUrl = (url) => {
  // Serve WASM files from public directory
  if (url.includes('canvaskit.wasm')) {
    return '/canvaskit.wasm';
  }
  return url;
};

const existingEnhancer = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware) => {
  const base = existingEnhancer ? existingEnhancer(middleware) : middleware;
  return (req, res, next) => {
    // Set WASM MIME type
    if (req.url && req.url.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    base(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './global.css' });
