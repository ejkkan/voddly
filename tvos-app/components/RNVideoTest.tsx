import React, { useMemo, useState, useCallback } from 'react';
import { Platform, View } from 'react-native';
import Video from 'react-native-video';
import { useScreenDimensions } from '@/hooks/useScreenDimensions';
import { ThemedButton } from './ThemedButton';
import { ThemedText, ThemedTextType } from './ThemedText';

import '@/global.css';

const DEFAULT_SOURCE =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const ALT_SOURCE = 'http://89.37.117.6:2095/movie/ngArk2Up/aSh3J7M/471479.mkv'; // 'http://89.37.117.6:2095/movie/ngArk2Up/aSh3J7M/1352705.mkv';

export default function RNVideoTest() {
  const { orientation } = useScreenDimensions();
  const [sourceUrl, setSourceUrl] = useState<string>(DEFAULT_SOURCE);
  const [lastError, setLastError] = useState<string | null>(null);

  const wrapperClassName = useMemo(() => {
    return (
      (orientation === 'landscape' ? 'flex-row ' : '') +
      'flex-column justify-center items-center'
    );
  }, [orientation]);

  const videoContainerClassName = useMemo(() => {
    return orientation === 'landscape'
      ? 'w-[50vw] h-[30vw] m-[5vw] bg-[--color-background]'
      : 'w-[90vw] h-[54vw] m-[5vw] bg-[--color-background]';
  }, [orientation]);

  const onError = useCallback((e: any) => {
    try {
      const { error, errorString, target } = e ?? {};
      const code = error?.code ?? target?.error?.code;
      const domain = target?.error?.domain;
      const message = errorString || error?.message || 'Playback error';
      const summary = [
        message,
        code ? `code=${code}` : null,
        domain ? `domain=${domain}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      setLastError(summary);
      console.log('react-native-video onError:', e, summary);
    } catch {
      setLastError('Playback error');
    }
  }, []);

  return (
    <View className={wrapperClassName}>
      <View className={videoContainerClassName}>
        {Platform.OS === 'web' ? (
          <View className="w-full h-full" />
        ) : (
          <Video
            source={{ uri: sourceUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            controls
            paused={false}
            playInBackground={false}
            ignoreSilentSwitch="ignore"
            onError={onError}
          />
        )}
      </View>
      <View>
        <ThemedButton onPress={() => setSourceUrl(DEFAULT_SOURCE)}>
          Switch to default
        </ThemedButton>
        <ThemedButton onPress={() => setSourceUrl(ALT_SOURCE)}>
          Switch to alternate
        </ThemedButton>
        {lastError ? (
          <ThemedText
            type={ThemedTextType.tiny}
            className="mt-[2vh] text-red-400"
          >
            {lastError}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
