export function shouldDebug(): boolean {
  try {
    // Toggle at runtime via: globalThis.__PASS_DEBUG = true
    const g = globalThis as any;
    if (typeof g.__PASS_DEBUG === 'boolean') return g.__PASS_DEBUG;
  } catch {}
  // Default to dev builds

  return typeof __DEV__ !== 'undefined' ? !!__DEV__ : false;
}

export function debugLog(...args: any[]) {
  if (!shouldDebug()) return;
  // Prefix for easy filtering

  // console.log('[passphrase]', ...args);
}
