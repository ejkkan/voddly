import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { Dimensions, StatusBar } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';

type Props = {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
};

export function ExpoVideoPlayerView(props: Props) {
  const { url, title, showBack, onBack } = props;

  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: (player as any).playing,
  }) as { isPlaying: boolean };

  const { currentTime = 0, duration = 0 } = (useEvent(player, 'timeUpdate', {
    currentTime: (player as any).currentTime ?? 0,
    duration: (player as any).duration ?? 0,
  }) as { currentTime: number; duration: number }) || {
    currentTime: 0,
    duration: 0,
  };

  const [showControls, setShowControls] = React.useState(true);
  const [isFull, setIsFull] = React.useState(false);
  const [hasError, setHasError] = React.useState<string | null>(null);

  useEvent(player, 'error', {
    // Using selector form ensures compatibility even if types differ
    error: null,
  });

  const toggleFullScreen = React.useCallback(() => {
    setIsFull((prev) => {
      const next = !prev;
      try {
        StatusBar.setHidden(next);
      } catch {}
      return next;
    });
  }, []);

  const onSeek = React.useCallback(
    (value: number) => {
      const safeDuration = Math.max(0, Math.floor(duration));
      if (safeDuration <= 0) return;
      const target = Math.max(0, Math.min(safeDuration, value));
      try {
        (player as any).seekTo?.(target);
      } catch {
        try {
          (player as any).seek?.(target);
        } catch {}
      }
    },
    [player, duration]
  );

  const fmt = (s: number) => {
    const sec = Math.max(0, Math.floor(s));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const sc = sec % 60;
    const mm = m < 10 ? `0${m}` : String(m);
    const ss = sc < 10 ? `0${sc}` : String(sc);
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const { width } = Dimensions.get('window');

  return (
    <View className={isFull ? 'flex-1 bg-black' : 'flex-1 bg-black'}>
      <Pressable className="flex-1" onPress={() => setShowControls((v) => !v)}>
        <VideoView
          style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
      </Pressable>

      {showControls && (
        <View className="absolute inset-x-0 top-0">
          <View className="flex-row items-center p-3">
            {showBack ? (
              <Pressable
                className="mr-2 rounded-md bg-white/10 px-3 py-2"
                onPress={onBack}
              >
                <Text className="text-white">Back</Text>
              </Pressable>
            ) : null}
            {title ? (
              <Text className="text-sm text-white" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {showControls && (
        <View className="absolute inset-x-0 bottom-0 p-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => {
                try {
                  if (isPlaying) {
                    (player as any).pause?.();
                  } else {
                    (player as any).play?.();
                  }
                } catch {}
              }}
            >
              <Text className="text-white">{isPlaying ? 'Pause' : 'Play'}</Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={toggleFullScreen}
            >
              <Text className="text-white">
                {isFull ? 'Exit Fullscreen' : 'Fullscreen'}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center">
            <Text className="mr-2 text-xs text-white" style={{ width: 48 }}>
              {fmt(currentTime)}
            </Text>
            <View
              style={{
                flex: 1,
                height: 4,
                backgroundColor: '#3f3f46',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                  backgroundColor: '#22c55e',
                }}
              />
            </View>
            <Text
              className="ml-2 text-xs text-white"
              style={{ width: 48, textAlign: 'right' }}
            >
              {fmt(duration)}
            </Text>
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => onSeek(Math.max(0, currentTime - 15))}
            >
              <Text className="text-white">-15s</Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => onSeek(currentTime + 30)}
            >
              <Text className="text-white">+30s</Text>
            </Pressable>
            {hasError ? (
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2"
                onPress={() => {
                  setHasError(null);
                  try {
                    (player as any).play?.();
                  } catch {}
                }}
              >
                <Text className="text-white">Retry</Text>
              </Pressable>
            ) : null}
          </View>
          {hasError ? (
            <Text className="mt-2 text-xs text-red-400">{hasError}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default ExpoVideoPlayerView;
