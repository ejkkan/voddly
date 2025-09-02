// React UseAnimations Icons Mapping
// This file provides a comprehensive mapping of all available react-useanimations icons
// Import only the icons you need to keep bundle size optimized

import UseAnimations from 'react-useanimations';

// Import all available animated icons
import activity from 'react-useanimations/lib/activity';
import airplay from 'react-useanimations/lib/airplay';
import alertCircle from 'react-useanimations/lib/alertCircle';
import alertOctagon from 'react-useanimations/lib/alertOctagon';
import alertTriangle from 'react-useanimations/lib/alertTriangle';
import archive from 'react-useanimations/lib/archive';
import arrowDown from 'react-useanimations/lib/arrowDown';
import arrowDownCircle from 'react-useanimations/lib/arrowDownCircle';
import arrowLeftCircle from 'react-useanimations/lib/arrowLeftCircle';
import arrowRightCircle from 'react-useanimations/lib/arrowRightCircle';
import arrowUp from 'react-useanimations/lib/arrowUp';
import arrowUpCircle from 'react-useanimations/lib/arrowUpCircle';
import behance from 'react-useanimations/lib/behance';
import bookmark from 'react-useanimations/lib/bookmark';
import calendar from 'react-useanimations/lib/calendar';
import checkBox from 'react-useanimations/lib/checkBox';
import checkmark from 'react-useanimations/lib/checkmark';
import codepen from 'react-useanimations/lib/codepen';
import copy from 'react-useanimations/lib/copy';
import download from 'react-useanimations/lib/download';
import dribbble from 'react-useanimations/lib/dribbble';
import edit from 'react-useanimations/lib/edit';
import error from 'react-useanimations/lib/error';
import explore from 'react-useanimations/lib/explore';
import facebook from 'react-useanimations/lib/facebook';
import folder from 'react-useanimations/lib/folder';
import github from 'react-useanimations/lib/github';
import heart from 'react-useanimations/lib/heart';
import help from 'react-useanimations/lib/help';
import home from 'react-useanimations/lib/home';
import infinity from 'react-useanimations/lib/infinity';
import info from 'react-useanimations/lib/info';
import instagram from 'react-useanimations/lib/instagram';
import linkedin from 'react-useanimations/lib/linkedin';
import loading from 'react-useanimations/lib/loading';
import loading2 from 'react-useanimations/lib/loading2';
import loading3 from 'react-useanimations/lib/loading3';
import lock from 'react-useanimations/lib/lock';
import mail from 'react-useanimations/lib/mail';
import maximizeMinimize from 'react-useanimations/lib/maximizeMinimize';
import maximizeMinimize2 from 'react-useanimations/lib/maximizeMinimize2';
import menu from 'react-useanimations/lib/menu';
import menu2 from 'react-useanimations/lib/menu2';
import menu3 from 'react-useanimations/lib/menu3';
import menu4 from 'react-useanimations/lib/menu4';
import microphone from 'react-useanimations/lib/microphone';
import microphone2 from 'react-useanimations/lib/microphone2';
import notification from 'react-useanimations/lib/notification';
import notification2 from 'react-useanimations/lib/notification2';
import playPause from 'react-useanimations/lib/playPause';
import playPauseCircle from 'react-useanimations/lib/playPauseCircle';
import plusToX from 'react-useanimations/lib/plusToX';
import pocket from 'react-useanimations/lib/pocket';
import radioButton from 'react-useanimations/lib/radioButton';
import scrollDown from 'react-useanimations/lib/scrollDown';
import searchToX from 'react-useanimations/lib/searchToX';
import settings from 'react-useanimations/lib/settings';
import settings2 from 'react-useanimations/lib/settings2';
import share from 'react-useanimations/lib/share';
import skipBack from 'react-useanimations/lib/skipBack';
import skipForward from 'react-useanimations/lib/skipForward';
import star from 'react-useanimations/lib/star';
import thumbUp from 'react-useanimations/lib/thumbUp';
import toggle from 'react-useanimations/lib/toggle';
import trash from 'react-useanimations/lib/trash';
import trash2 from 'react-useanimations/lib/trash2';
import twitter from 'react-useanimations/lib/twitter';
import userMinus from 'react-useanimations/lib/userMinus';
import userPlus from 'react-useanimations/lib/userPlus';
import userX from 'react-useanimations/lib/userX';
import video from 'react-useanimations/lib/video';
import video2 from 'react-useanimations/lib/video2';
import visibility from 'react-useanimations/lib/visibility';
import visibility2 from 'react-useanimations/lib/visibility2';
import volume from 'react-useanimations/lib/volume';
import youtube from 'react-useanimations/lib/youtube';
import youtube2 from 'react-useanimations/lib/youtube2';
import zoomIn from 'react-useanimations/lib/zoomIn';
import zoomOut from 'react-useanimations/lib/zoomOut';

// Comprehensive icon mapping for easy access
export const ANIMATED_ICONS = {
  // Navigation & UI
  activity,
  home,
  explore,
  menu,
  menu2,
  menu3,
  menu4,
  settings,
  settings2,
  help,
  info,

  // Media & Entertainment
  airplay,
  video,
  video2,
  playPause,
  playPauseCircle,
  skipBack,
  skipForward,
  volume,
  youtube,
  youtube2,
  microphone,
  microphone2,

  // User & Social
  heart,
  bookmark,
  star,
  thumbUp,
  share,
  notification,
  notification2,
  userPlus,
  userMinus,
  userX,

  // Actions & Controls
  edit,
  copy,
  download,
  trash,
  trash2,
  archive,
  folder,
  lock,
  toggle,
  checkBox,
  checkmark,
  radioButton,

  // Arrows & Navigation
  arrowUp,
  arrowDown,
  arrowUpCircle,
  arrowDownCircle,
  arrowLeftCircle,
  arrowRightCircle,
  scrollDown,

  // Search & Zoom
  searchToX,
  zoomIn,
  zoomOut,
  visibility,
  visibility2,

  // Alerts & Status
  alertCircle,
  alertOctagon,
  alertTriangle,
  error,
  loading,
  loading2,
  loading3,
  infinity,

  // Utilities
  calendar,
  mail,
  maximizeMinimize,
  maximizeMinimize2,
  plusToX,

  // Social Media
  facebook,
  instagram,
  twitter,
  linkedin,
  github,
  behance,
  dribbble,
  codepen,
  pocket,
} as const;

// Type for available icon names
export type AnimatedIconName = keyof typeof ANIMATED_ICONS;

// Icon categories for easier organization
export const ICON_CATEGORIES = {
  navigation: [
    'home',
    'explore',
    'menu',
    'menu2',
    'menu3',
    'menu4',
    'settings',
    'settings2',
  ] as AnimatedIconName[],
  media: [
    'video',
    'video2',
    'playPause',
    'playPauseCircle',
    'skipBack',
    'skipForward',
    'volume',
    'airplay',
  ] as AnimatedIconName[],
  user: [
    'heart',
    'bookmark',
    'star',
    'thumbUp',
    'notification',
    'notification2',
    'userPlus',
    'userMinus',
  ] as AnimatedIconName[],
  actions: [
    'edit',
    'copy',
    'download',
    'trash',
    'trash2',
    'archive',
    'folder',
    'checkmark',
  ] as AnimatedIconName[],
  arrows: [
    'arrowUp',
    'arrowDown',
    'arrowUpCircle',
    'arrowDownCircle',
    'scrollDown',
  ] as AnimatedIconName[],
  search: [
    'searchToX',
    'zoomIn',
    'zoomOut',
    'visibility',
    'visibility2',
  ] as AnimatedIconName[],
  alerts: [
    'alertCircle',
    'alertTriangle',
    'error',
    'loading',
    'loading2',
    'loading3',
  ] as AnimatedIconName[],
  social: [
    'facebook',
    'instagram',
    'twitter',
    'linkedin',
    'github',
    'youtube',
    'youtube2',
  ] as AnimatedIconName[],
} as const;

// Mapping for common UI patterns to animated icons
export const UI_ICON_MAPPING = {
  // Navigation
  dashboard: 'home',
  favorites: 'heart',
  playlists: 'bookmark',
  sources: 'folder',
  notifications: 'notification',
  profile: 'userPlus',
  settings: 'settings',

  // Media
  movies: 'video',
  series: 'video2',
  tv: 'airplay',
  play: 'playPause',

  // Actions
  search: 'searchToX',
  edit: 'edit',
  delete: 'trash',
  download: 'download',
  share: 'share',

  // Status
  loading: 'loading2',
  error: 'error',
  success: 'checkmark',
} as const;

// Export UseAnimations component for direct use
export { UseAnimations };
export default ANIMATED_ICONS;
