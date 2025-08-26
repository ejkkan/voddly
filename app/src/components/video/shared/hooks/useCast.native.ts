import { useState, useEffect, useCallback, useRef } from 'react';
import GoogleCast, { CastButton as GCastButton } from 'react-native-google-cast';
import { CastState, CastDevice } from '../types/player.types';

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
  const sessionManagerRef = useRef<any>(null);
  const castChannelRef = useRef<any>(null);

  // Initialize Google Cast
  useEffect(() => {
    const initializeCast = async () => {
      try {
        // Initialize Cast SDK
        await GoogleCast.initChannel('urn:x-cast:com.example.custom');
        
        sessionManagerRef.current = GoogleCast.getSessionManager();
        castChannelRef.current = GoogleCast.getChannel();

        // Set up event listeners
        const subscription = GoogleCast.EventEmitter.addListener(
          GoogleCast.CAST_STATE_CHANGED,
          (castState: any) => {
            console.log('Cast state changed:', castState);
            handleCastStateChange(castState);
          }
        );

        // Device availability listener
        const deviceSubscription = GoogleCast.EventEmitter.addListener(
          GoogleCast.DEVICES_UPDATED,
          (devices: any[]) => {
            console.log('Devices updated:', devices);
            setDevices(devices.map(device => ({
              id: device.deviceId,
              name: device.friendlyName,
              model: device.modelName,
              isConnected: device.isConnected || false,
            })));
            
            if (devices.length > 0) {
              setCastState(prev => 
                prev === 'NO_DEVICES_AVAILABLE' ? 'NOT_CONNECTED' : prev
              );
            } else {
              setCastState('NO_DEVICES_AVAILABLE');
            }
          }
        );

        // Session events
        const sessionStartedSubscription = GoogleCast.EventEmitter.addListener(
          GoogleCast.SESSION_STARTED,
          (session: any) => {
            console.log('Session started:', session);
            handleSessionStarted(session);
          }
        );

        const sessionEndedSubscription = GoogleCast.EventEmitter.addListener(
          GoogleCast.SESSION_ENDED,
          () => {
            console.log('Session ended');
            setCastState('NOT_CONNECTED');
            setCurrentDevice(null);
          }
        );

        // Media status updates
        const mediaStatusSubscription = GoogleCast.EventEmitter.addListener(
          GoogleCast.MEDIA_STATUS_UPDATED,
          (mediaStatus: any) => {
            console.log('Media status updated:', mediaStatus);
          }
        );

        // Check initial cast state
        const currentCastState = await GoogleCast.getCastState();
        handleCastStateChange(currentCastState);

        // Scan for devices
        await GoogleCast.startDiscovery();

        return () => {
          subscription.remove();
          deviceSubscription.remove();
          sessionStartedSubscription.remove();
          sessionEndedSubscription.remove();
          mediaStatusSubscription.remove();
        };
      } catch (error) {
        console.error('Failed to initialize Cast:', error);
        setCastState('NO_DEVICES_AVAILABLE');
      }
    };

    initializeCast();
  }, []);

  // Handle cast state changes
  const handleCastStateChange = (state: string) => {
    switch (state) {
      case 'NoDevicesAvailable':
        setCastState('NO_DEVICES_AVAILABLE');
        break;
      case 'NotConnected':
        setCastState('NOT_CONNECTED');
        break;
      case 'Connecting':
        setCastState('CONNECTING');
        break;
      case 'Connected':
        setCastState('CONNECTED');
        break;
      default:
        setCastState('NOT_CONNECTED');
    }
  };

  // Handle session started
  const handleSessionStarted = async (session: any) => {
    try {
      const device = await GoogleCast.getDevice();
      if (device) {
        setCurrentDevice({
          id: device.deviceId,
          name: device.friendlyName,
          model: device.modelName,
          isConnected: true,
        });
      }
      setCastState('CONNECTED');
      
      // Load media automatically
      await loadMedia();
    } catch (error) {
      console.error('Error handling session start:', error);
    }
  };

  // Load media on cast device
  const loadMedia = async () => {
    try {
      await GoogleCast.castMedia({
        mediaUrl: url,
        title: title || 'Video',
        subtitle: '',
        studio: '',
        streamDuration: duration,
        contentType: 'video/mp4',
        playPosition: currentTime,
        customData: {
          customKey: 'customValue',
        },
      });
      console.log('Media loaded on cast device');
    } catch (error) {
      console.error('Failed to load media:', error);
    }
  };

  // Start casting
  const startCast = useCallback(async () => {
    try {
      // Show device picker
      const success = await GoogleCast.showCastDialog();
      if (success) {
        setCastState('CONNECTING');
      }
    } catch (error) {
      console.error('Error starting cast:', error);
      setCastState('NOT_CONNECTED');
    }
  }, []);

  // Stop casting
  const stopCast = useCallback(async () => {
    try {
      await GoogleCast.endSession();
      setCastState('NOT_CONNECTED');
      setCurrentDevice(null);
    } catch (error) {
      console.error('Error stopping cast:', error);
    }
  }, []);

  // Playback controls
  const play = useCallback(async () => {
    try {
      await GoogleCast.play();
    } catch (error) {
      console.error('Error playing:', error);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await GoogleCast.pause();
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }, []);

  const seek = useCallback(async (time: number) => {
    try {
      await GoogleCast.seek(time);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, []);

  const setVolume = useCallback(async (level: number) => {
    try {
      await GoogleCast.setVolume(level);
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }, []);

  const toggleMute = useCallback(async () => {
    try {
      const isMuted = await GoogleCast.isMuted();
      await GoogleCast.setMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, []);

  // Get current playback position
  const getCastTime = useCallback(async () => {
    try {
      const mediaStatus = await GoogleCast.getMediaStatus();
      return mediaStatus?.playPosition || 0;
    } catch (error) {
      console.error('Error getting cast time:', error);
      return 0;
    }
  }, []);

  // Get media duration
  const getCastDuration = useCallback(async () => {
    try {
      const mediaStatus = await GoogleCast.getMediaStatus();
      return mediaStatus?.streamDuration || 0;
    } catch (error) {
      console.error('Error getting cast duration:', error);
      return 0;
    }
  }, []);

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