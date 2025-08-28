// User management endpoints
export * from './getCurrentUser';
export * from './getUserById';
export * from './metadata';
export * from './updateCurrentUser';

// Account & source management
export * from './accounts';

// Profile management (Netflix-style)
export * from './profiles';

// Watch state management
export * from './watchState';

// Subtitles
export * from './subtitles';
// Register additional subtitle endpoints (one file per endpoint)
import './subtitles/get-subtitles-by-tmdb';

// Trends proxy
export * from './trends';
