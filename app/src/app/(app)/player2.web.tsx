import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';

export default function Player2() {
  const { video } = useLocalSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!video || !videoRef.current) return;
    console.log('Video:', video);
    const initPlayer = async () => {
      try {
        // Load Shaka Player
        const shakaModule = await import('shaka-player');
        const shaka = shakaModule.default || (globalThis as any).shaka;

        if (!shaka || !shaka.Player) {
          throw new Error('Shaka Player not available');
        }

        // Create player and attach to video element
        const player = new shaka.Player();
        await player.attach(videoRef.current);

        // Load the video URL
        await player.load(`http://${video as string}`);

        console.log('Video loaded successfully');
      } catch (error) {
        console.error('Failed to load video:', error);
      }
    };

    initPlayer();
  }, [video]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black' }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        autoPlay
      />
    </div>
  );
}
