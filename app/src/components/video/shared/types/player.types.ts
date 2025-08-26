// Core player types shared across all implementations

export type CastState = 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface CastDevice {
  id: string;
  name: string;
  model?: string;
  isConnected: boolean;
}

export interface BasePlayerProps {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  movieId?: string;
  tmdbId?: number;
  type?: 'movie' | 'series' | 'live';
  autoPlay?: boolean;
  startTime?: number;
  // Layout & Theme
  layout?: 'netflix' | 'minimal';
  theme?: 'default' | 'compact';
}

export interface PlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  hasError: string | null;
  currentTime: number;
  duration: number;
  buffering: boolean;
  volume: number;
  isMuted: boolean;
  // Track info
  audioTracks: AudioTrack[];
  selectedAudioTrack?: string;
  subtitleTracks: SubtitleTrack[];
  selectedSubtitleTrack?: string;
  // Cast state
  castState?: CastState;
  isCasting?: boolean;
  castDevice?: string;
}

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  selectAudioTrack: (trackId: string) => void;
  selectSubtitleTrack: (trackId: string) => void;
  toggleFullscreen: () => void;
  retry: () => void;
  // Cast controls
  startCast?: () => void;
  stopCast?: () => void;
}

export interface AudioTrack {
  id: string;
  language: string;
  label?: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label?: string;
}

export interface PlayerLayoutProps {
  // Core elements
  videoElement: React.ReactNode;
  playerState: PlayerState;
  controls: PlayerControls;
  
  // Metadata
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  
  // UI state
  showControls: boolean;
  setShowControls: (show: boolean) => void;
}