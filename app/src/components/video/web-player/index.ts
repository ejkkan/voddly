// Export the new refactored WebPlayer as default
export { default } from './WebPlayerNew';

// Keep the old WebPlayer available for backwards compatibility
export type { WebPlayerProps } from './WebPlayer';
export { WebPlayer } from './WebPlayer';
export { WebPlayer as WebPlayerLegacy } from './WebPlayer';
export { useWebPlaybackSource } from './useWebPlaybackSource';
