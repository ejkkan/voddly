import { useState, useEffect, useCallback, useRef } from 'react';
import { CastState, CastDevice } from '../types/player.types';

declare global {
  interface Window {
    chrome: any;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

interface UseCastProps {
  url: string;
  title?: string;
  currentTime?: number;
  duration?: number;
  onCastStateChange?: (state: CastState) => void;
}

export function useCast({ url, title, currentTime = 0, duration = 0, onCastStateChange }: UseCastProps) {
  const [castState, setCastState] = useState<CastState>('NO_DEVICES_AVAILABLE');
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [currentDevice, setCurrentDevice] = useState<CastDevice | null>(null);
  const castSessionRef = useRef<any>(null);
  const castContextRef = useRef<any>(null);
  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);

  // Initialize Cast API
  useEffect(() => {
    const initializeCastApi = () => {
      if (!window.chrome || !window.chrome.cast) {
        console.log('Cast API not available');
        return;
      }

      const cast = window.chrome.cast;
      const castContext = cast.framework.CastContext.getInstance();
      castContextRef.current = castContext;

      // Configure Cast options
      castContext.setOptions({
        receiverApplicationId: cast.framework.CastContext.DEFAULT_RECEIVER_APP_ID,
        autoJoinPolicy: cast.framework.AutoJoinPolicy.ORIGIN_SCOPED,
        language: 'en-US',
        resumeSavedSession: true,
      });

      // Set up remote player
      const remotePlayer = new cast.framework.RemotePlayer();
      const remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);
      remotePlayerRef.current = remotePlayer;
      remotePlayerControllerRef.current = remotePlayerController;

      // Listen for Cast state changes
      castContext.addEventListener(
        cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event: any) => {
          switch (event.castState) {
            case cast.framework.CastState.NO_DEVICES_AVAILABLE:
              setCastState('NO_DEVICES_AVAILABLE');
              break;
            case cast.framework.CastState.NOT_CONNECTED:
              setCastState('NOT_CONNECTED');
              setCurrentDevice(null);
              break;
            case cast.framework.CastState.CONNECTING:
              setCastState('CONNECTING');
              break;
            case cast.framework.CastState.CONNECTED:
              setCastState('CONNECTED');
              handleConnected();
              break;
          }
        }
      );

      // Listen for session state changes
      castContext.addEventListener(
        cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (event: any) => {
          console.log('Session state changed:', event.sessionState);
          castSessionRef.current = event.session;
        }
      );

      // Check initial state
      const initialState = castContext.getCastState();
      if (initialState === cast.framework.CastState.CONNECTED) {
        handleConnected();
      } else if (initialState === cast.framework.CastState.NOT_CONNECTED) {
        setCastState('NOT_CONNECTED');
      }
    };

    // Wait for Cast API to be available
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        initializeCastApi();
      }
    };

    // If Cast API is already loaded
    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
      initializeCastApi();
    }

    // Load Cast API script if not already loaded
    if (!document.getElementById('cast-api-script')) {
      const script = document.createElement('script');
      script.id = 'cast-api-script';
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      document.head.appendChild(script);
    }
  }, []);

  // Handle connected state
  const handleConnected = useCallback(() => {
    const castContext = castContextRef.current;
    if (!castContext) return;

    const session = castContext.getCurrentSession();
    if (session) {
      castSessionRef.current = session;
      const device = session.getCastDevice();
      setCurrentDevice({
        id: device.deviceId,
        name: device.friendlyName,
        model: device.modelName,
        isConnected: true,
      });
      setCastState('CONNECTED');
    }
  }, []);

  // Start casting
  const startCast = useCallback(async () => {
    try {
      const castContext = castContextRef.current;
      if (!castContext) {
        console.error('Cast context not initialized');
        return;
      }

      // Request session (shows device picker)
      const session = await castContext.requestSession();
      if (!session) return;

      castSessionRef.current = session;

      // Load media
      const mediaInfo = new window.chrome.cast.media.MediaInfo(url, 'video/mp4');
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title || 'Video';
      mediaInfo.metadata.images = [];

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.currentTime = currentTime;
      request.autoplay = true;

      await session.loadMedia(request);
      console.log('Media loaded successfully');
    } catch (error) {
      console.error('Error starting cast:', error);
      setCastState('NOT_CONNECTED');
    }
  }, [url, title, currentTime]);

  // Stop casting
  const stopCast = useCallback(() => {
    const castContext = castContextRef.current;
    if (!castContext) return;

    const session = castContext.getCurrentSession();
    if (session) {
      session.endSession(true);
    }
    setCastState('NOT_CONNECTED');
    setCurrentDevice(null);
  }, []);

  // Control playback on cast device
  const play = useCallback(() => {
    const controller = remotePlayerControllerRef.current;
    if (controller && remotePlayerRef.current) {
      controller.playOrPause();
    }
  }, []);

  const pause = useCallback(() => {
    const controller = remotePlayerControllerRef.current;
    if (controller && remotePlayerRef.current) {
      controller.playOrPause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const controller = remotePlayerControllerRef.current;
    const player = remotePlayerRef.current;
    if (controller && player) {
      player.currentTime = time;
      controller.seek();
    }
  }, []);

  const setVolume = useCallback((level: number) => {
    const controller = remotePlayerControllerRef.current;
    const player = remotePlayerRef.current;
    if (controller && player) {
      player.volumeLevel = level;
      controller.setVolumeLevel();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const controller = remotePlayerControllerRef.current;
    if (controller) {
      controller.muteOrUnmute();
    }
  }, []);

  // Get current cast time
  const getCastTime = useCallback(() => {
    const player = remotePlayerRef.current;
    return player ? player.currentTime : 0;
  }, []);

  // Get cast duration
  const getCastDuration = useCallback(() => {
    const player = remotePlayerRef.current;
    return player ? player.duration : 0;
  }, []);

  // Check if casting
  const isCasting = castState === 'CONNECTED';

  useEffect(() => {
    onCastStateChange?.(castState);
  }, [castState, onCastStateChange]);

  return {
    castState,
    devices,
    currentDevice,
    isCasting,
    startCast,
    stopCast,
    // Playback controls for cast session
    castControls: {
      play,
      pause,
      seek,
      setVolume,
      toggleMute,
      getCastTime,
      getCastDuration,
    },
  };
}