'use client';

import React from 'react';

type Props = { url: string };

function withTimestamp(base: string): string {
  try {
    const u = new URL(base, window.location.href);
    u.searchParams.set('__ts', String(Date.now()));
    return u.toString();
  } catch {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}__ts=${Date.now()}`;
  }
}

function hardReset(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch {}
  try {
    (video as any).src = '';
    while (video.firstChild) video.removeChild(video.firstChild);
    video.removeAttribute('src');
    video.load();
  } catch {}
}

export function SimpleShakaWebPlayer({ url }: Props) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const timersRef = React.useRef<number[]>([]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const addTimer = (id: number) => timersRef.current.push(id);
    const clearTimers = () => {
      try {
        for (const id of timersRef.current.splice(0)) clearTimeout(id);
      } catch {}
    };

    // Configure element
    try {
      (video as any).preload = 'auto';
      (video as any).playsInline = true;
      video.muted = true;
      video.autoplay = true;
    } catch {}

    // 1) Hard reset, then set URL after a brief delay and play
    hardReset(video);
    addTimer(
      window.setTimeout(() => {
        if (cancelled) return;
        (video as HTMLVideoElement).src = withTimestamp(url);
        video.load();
        addTimer(
          window.setTimeout(() => {
            if (cancelled) return;
            try {
              void video.play();
            } catch {}
          }, 300)
        );
      }, 150)
    );

    // 2) Watchdog retry if still not loaded at 4s
    addTimer(
      window.setTimeout(() => {
        if (cancelled) return;
        if (video.readyState === 0 || !video.currentSrc) {
          hardReset(video);
          (video as HTMLVideoElement).src = withTimestamp(url);
          video.load();
          addTimer(
            window.setTimeout(() => {
              if (cancelled) return;
              try {
                void video.play();
              } catch {}
            }, 350)
          );
        }
      }, 4000)
    );

    return () => {
      cancelled = true;
      clearTimers();
      hardReset(video);
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      className="size-full object-contain"
      playsInline
      autoPlay
      muted
      preload="auto"
      controls
    />
  );
}

export default SimpleShakaWebPlayer;
