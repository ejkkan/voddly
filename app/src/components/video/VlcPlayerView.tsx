import React from 'react';
import { Platform, StatusBar, Dimensions } from 'react-native';
import { View, Text, Pressable } from '@/components/ui';
import { VLCPlayer } from 'react-native-vlc-media-player';

type Props = {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
};

export function VlcPlayerView(props: Props) {
  const { url, title, showBack, onBack } = props;
  const playerRef = React.useRef<any>(null);
  const [paused, setPaused] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0); // seconds
  const [duration, setDuration] = React.useState(0); // seconds
  const [showControls, setShowControls] = React.useState(true);
  const [isFull, setIsFull] = React.useState(false);

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
      if (!playerRef.current || duration <= 0) return;
      if (Platform.OS === 'ios') {
        const fraction = Math.max(0, Math.min(1, value / duration));
        playerRef.current.seek(Number(fraction.toFixed(6)));
      } else {
        playerRef.current.seek(Math.floor(value));
      }
    },
    [duration]
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

  const { width, height } = Dimensions.get('window');

  return (
    <View className={isFull ? 'flex-1 bg-black' : 'flex-1 bg-black'}>
      <Pressable className="flex-1" onPress={() => setShowControls((v) => !v)}>
        <VLCPlayer
          ref={playerRef}
          style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
          source={{ uri: url }}
          autoplay={true}
          paused={paused}
          autoAspectRatio={true}
          resizeMode="contain"
          videoAspectRatio={
            Platform.OS === 'android'
              ? `${width}:${isFull ? width : Math.floor((width * 9) / 16)}`
              : '16:9'
          }
          onPlaying={() => {
            setIsLoading(false);
            setHasError(null);
          }}
          onBuffering={() => setIsLoading(true)}
          onPaused={() => setPaused(true)}
          onStopped={() => setPaused(true)}
          onEnded={() => setPaused(true)}
          onError={() => setHasError('Playback error')}
          onProgress={(e: any) => {
            // e.duration/currentTime are in ms
            const d = Math.max(0, Math.floor((e?.duration ?? 0) / 1000));
            const ct = Math.max(0, Math.floor((e?.currentTime ?? 0) / 1000));
            if (d) setDuration(d);
            setCurrentTime(ct);
            setIsLoading(false);
          }}
        />
      </Pressable>

      {/* Top bar */}
      {showControls && (
        <View className="absolute left-0 right-0 top-0">
          <View className="flex-row items-center p-3">
            {showBack ? (
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2 mr-2"
                onPress={onBack}
              >
                <Text className="text-white">Back</Text>
              </Pressable>
            ) : null}
            {title ? (
              <Text className="text-white text-sm" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Bottom controls */}
      {showControls && (
        <View className="absolute left-0 right-0 bottom-0 p-3">
          <View className="flex-row items-center justify-between mb-2">
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => setPaused((p) => !p)}
            >
              <Text className="text-white">{paused ? 'Play' : 'Pause'}</Text>
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
            <Text className="text-white text-xs mr-2" style={{ width: 48 }}>
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
              className="text-white text-xs ml-2"
              style={{ width: 48, textAlign: 'right' }}
            >
              {fmt(duration)}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mt-2">
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
                    playerRef.current?.resume &&
                      playerRef.current.resume(false);
                  } catch {}
                }}
              >
                <Text className="text-white">Retry</Text>
              </Pressable>
            ) : null}
          </View>
          {hasError ? (
            <Text className="text-red-400 text-xs mt-2">{hasError}</Text>
          ) : null}
          {isLoading ? (
            <Text className="text-white/80 text-xs mt-2">Buffering…</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default VlcPlayerView;
