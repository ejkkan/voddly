// Export the new refactored WebPlayer as default
export { default } from './WebPlayerNew';

// Keep the old WebPlayer available for backwards compatibility
export { WebPlayer as WebPlayerLegacy } from './WebPlayer';
export { useWebPlaybackSource } from './useWebPlaybackSource';