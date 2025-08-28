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

// Subtitles (to be moved to metadata service; proxies may live here)
// export * from './subtitles';

// Favorites & Watchlist
export * from './favorites';
export * from './watchlist';

// Player bundle
export * from './player';

// Playlists
export * from './playlists';

// Trends proxy
export * from './trends';
