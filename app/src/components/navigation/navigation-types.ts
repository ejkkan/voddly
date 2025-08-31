export type ContentHref =
  | '/(app)/dashboard'
  | '/(app)/movies'
  | '/(app)/series'
  | '/(app)/tv';

export type ProfileHref =
  | '/(app)/favorites'
  | '/(app)/playlists'
  | '/(app)/settings'
  | '/(app)/profiles'
  | '/(app)/sources'
  | '/(app)/search';

export type AllHref = ContentHref | ProfileHref;

export type NavItem<T = AllHref> = {
  label: string;
  href: T;
  icon?: string;
};

export const CONTENT_NAV_ITEMS: NavItem<ContentHref>[] = [
  { label: 'Home', href: '/(app)/dashboard' },
  { label: 'Movies', href: '/(app)/movies' },
  { label: 'Series', href: '/(app)/series' },
  { label: 'TV', href: '/(app)/tv' },
];

export const PROFILE_NAV_ITEMS: NavItem<ProfileHref>[] = [
  { label: 'Search', href: '/(app)/search' },
  { label: 'Favorites', href: '/(app)/favorites' },
  { label: 'Playlists', href: '/(app)/playlists' },
  { label: 'Sources', href: '/(app)/sources' },
  { label: 'Profiles', href: '/(app)/profiles' },
  { label: 'Settings', href: '/(app)/settings' },
];

export const MOBILE_TAB_ITEMS: NavItem[] = [
  { label: 'Home', href: '/(app)/dashboard', icon: 'home' },
  { label: 'Favorites', href: '/(app)/favorites', icon: 'heart' },
  { label: 'Playlists', href: '/(app)/playlists', icon: 'list' },
  { label: 'Sources', href: '/(app)/sources', icon: 'sources' },
  { label: 'Settings', href: '/(app)/settings', icon: 'settings' },
];
