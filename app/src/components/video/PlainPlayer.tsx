import React, { useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { getDefaultPlayer } from './shared/utils/platformHelpers';

interface PlainPlayerProps {
  url: string;
  style?: any;
}

export function PlainPlayer({ url, style }: PlainPlayerProps) {
  const playerType = getDefaultPlayer(url);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || playerType !== 'web') return;

    let shakaPlayer: any = null;

    const initPlayer = async () => {
      try {
        const urlPath = (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url.split('?')[0];
          }
        })();
        const ext = (urlPath.split('.').pop() || '').toLowerCase();
        const isHls = ext === 'm3u8';
        const canNativeHls = isHls && typeof video.canPlayType === 'function' && 
                            video.canPlayType('application/vnd.apple.mpegurl') !== '';

        // Use Shaka for HLS streams that can't be played natively (like the regular player does)
        if (isHls && !canNativeHls) {
          try {
            const shakaModule = await import('shaka-player');
            const Shaka = shakaModule.default || shakaModule;
            
            if (Shaka && Shaka.Player) {
              shakaPlayer = new Shaka.Player();
              await shakaPlayer.attach(video);
              await shakaPlayer.load(url);
              console.log('Using Shaka Player for HLS stream');
            }
          } catch (error) {
            console.log('Shaka Player failed, falling back to native:', error);
            video.src = url;
          }
        } else {
          video.src = url;
        }
      } catch (error) {
        console.log('Player initialization error:', error);
        video.src = url;
      }
    };

    const attemptPlay = async () => {
      try {
        // First try to play with audio
        video.muted = false;
        await video.play();
      } catch (error) {
        // If that fails, try muted autoplay
        try {
          video.muted = true;
          await video.play();
        } catch (mutedError) {
          console.log('Autoplay failed, user interaction required');
        }
      }
    };

    const handleError = (e: any) => {
      console.log('Video error:', e);
      // Try to reload on error (similar to regular player behavior)
      setTimeout(() => {
        if (video && !video.paused) {
          if (shakaPlayer) {
            shakaPlayer.load(url).catch(console.error);
          } else {
            video.load();
          }
        }
      }, 1000);
    };

    const handleClick = async () => {
      try {
        if (video.paused) {
          video.muted = false;
          await video.play();
        } else {
          video.pause();
        }
      } catch (error) {
        console.log('Play/pause failed:', error);
      }
    };

    // Initialize player
    initPlayer();

    // Attempt autoplay when video loads
    video.addEventListener('loadedmetadata', attemptPlay);
    
    // Add click handler
    video.addEventListener('click', handleClick);
    
    // Add error handler
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', attemptPlay);
      video.removeEventListener('click', handleClick);
      video.removeEventListener('error', handleError);
      
      // Cleanup Shaka player
      if (shakaPlayer) {
        try {
          shakaPlayer.destroy();
        } catch (e) {
          console.log('Error destroying Shaka player:', e);
        }
      }
    };
  }, [url, playerType]);

  if (playerType === 'web') {
    return (
      <video
        ref={videoRef}
        src={url}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: 'pointer',
          ...style,
        }}
      />
    );
  }

  if (playerType === 'vlc') {
    const VLC = require('react-native-vlc-media-player').VLCPlayer;
    return (
      <VLC
        source={{ uri: url }}
        autoplay={true}
        style={[
          {
            width: '100%',
            height: '100%',
          },
          style,
        ]}
      />
    );
  }

  const Video = require('react-native-video').default;
  return (
    <Video
      source={{ uri: url }}
      style={[
        {
          width: '100%',
          height: '100%',
        },
        style,
      ]}
      resizeMode="cover"
    />
  );
}