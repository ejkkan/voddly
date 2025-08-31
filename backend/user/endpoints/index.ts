// User management endpoints
export * from './getCurrentUser';
export * from './getUserById';
export * from './metadata';
export * from './updateCurrentUser';

// Subscription & source management
export * from './subscription';
export * from './device-auth';

// Profile management (Netflix-style)
export * from './profiles';

// Watch state management
export * from './watchState';

// Subtitles
export * from './subtitles';

// Favorites
export * from './favorites';

// Player bundle
export * from './player';

// Playlists
export * from './playlists';

// Trends proxy
export * from './trends';

// Passphrase setup (one-time only)
export * from './setup-passphrase';

// Internal endpoints (not exposed to frontend)
export * from './internal-encryption';
