// Re-export the main endpoint for backward compatibility
export { getMetadata } from './endpoints/get-metadata';

// Export types that other services might use
export type { ContentMetadata, GetMetadataParams } from './types';
