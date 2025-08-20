import React from 'react';
import { Dimensions, Platform, StatusBar } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';

import { Pressable, Text, View } from '@/components/ui';

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
  const [audioTracks, setAudioTracks] = React.useState<
    { id: number; name: string }[]
  >([]);
  const [textTracks, setTextTracks] = React.useState<
    { id: number; name: string }[]
  >([]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = React.useState<
    number | undefined
  >(undefined);
  const [selectedTextTrackId, setSelectedTextTrackId] = React.useState<
    number | undefined
  >(undefined);

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
          source={{
            uri: url,
            initType: 2,
            initOptions: [
              // '--rtsp-tcp',
              '--network-caching=1000',
              // '--no-audio',
              '--verbose=2',
            ],
          }}
          autoplay={true}
          paused={paused}
          autoAspectRatio={true}
          resizeMode="contain"
          audioTrack={selectedAudioTrackId ?? undefined}
          textTrack={selectedTextTrackId ?? undefined}
          onPlaying={() => {
            setIsLoading(false);
            setHasError(null);
          }}
          onBuffering={() => setIsLoading(true)}
          onPaused={() => setPaused(true)}
          onStopped={() => setPaused(true)}
          onEnd={() => setPaused(true)}
          onError={() => setHasError('Playback error')}
          onProgress={(e: any) => {
            // e.duration/currentTime are in ms
            const d = Math.max(0, Math.floor((e?.duration ?? 0) / 1000));
            const ct = Math.max(0, Math.floor((e?.currentTime ?? 0) / 1000));
            if (d) setDuration(d);
            setCurrentTime(ct);
            setIsLoading(false);
          }}
          onLoad={(info: any) => {
            const a = Array.isArray(info?.audioTracks) ? info.audioTracks : [];
            const t = Array.isArray(info?.textTracks) ? info.textTracks : [];
            setAudioTracks(a);
            setTextTracks(t);
            // Do not force-select on load; keep undefined to honor default until user changes
          }}
        />
      </Pressable>

      {/* Top bar */}
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

      {/* Bottom controls */}
      {showControls && (
        <View className="absolute inset-x-0 bottom-0 p-3">
          <View className="mb-2 flex-row items-center justify-between">
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

          {/* Tracks controls */}
          {(audioTracks.length > 0 || textTracks.length > 0) && (
            <View className="mt-2 flex-row items-center justify-start gap-2">
              {audioTracks.length > 0 ? (
                <Pressable
                  className="rounded-md bg-white/10 px-3 py-2"
                  onPress={() => {
                    if (audioTracks.length === 0) return;
                    // Cycle through available audio tracks
                    const list = audioTracks;
                    const currentIdx = list.findIndex(
                      (tr) => tr.id === (selectedAudioTrackId ?? -999999)
                    );
                    const nextIdx =
                      currentIdx >= 0 ? (currentIdx + 1) % list.length : 0;
                    setSelectedAudioTrackId(list[nextIdx]?.id);
                  }}
                >
                  <Text className="text-xs text-white">
                    {(() => {
                      const current = audioTracks.find(
                        (t) => t.id === selectedAudioTrackId
                      );
                      const label = current?.name ?? 'Default';
                      return `Audio: ${label}`;
                    })()}
                  </Text>
                </Pressable>
              ) : null}

              {textTracks.length > 0 ? (
                <Pressable
                  className="rounded-md bg-white/10 px-3 py-2"
                  onPress={() => {
                    if (textTracks.length === 0) return;
                    const list = textTracks;
                    const currentIdx = list.findIndex(
                      (tr) => tr.id === (selectedTextTrackId ?? -999999)
                    );
                    const nextIdx =
                      currentIdx >= 0 ? (currentIdx + 1) % list.length : 0;
                    setSelectedTextTrackId(list[nextIdx]?.id);
                  }}
                >
                  <Text className="text-xs text-white">
                    {(() => {
                      const current = textTracks.find(
                        (t) => t.id === selectedTextTrackId
                      );
                      const label = current?.name ?? 'Default';
                      return `Subs: ${label}`;
                    })()}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}

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
            <Text className="mt-2 text-xs text-red-400">{hasError}</Text>
          ) : null}
          {isLoading ? (
            <Text className="mt-2 text-xs text-white/80">Buffering…</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default VlcPlayerView;
