'use client';

import React from 'react';

type Props = { url: string };

export function IsolatedIframePlayer({ url }: Props) {
  const html = React.useMemo(() => {
    const enc = encodeURIComponent(url);
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head><body><video id="v" playsinline autoplay muted controls preload="auto"></video><script>(function(){try{var u=decodeURIComponent('${enc}');var v=document.getElementById('v');v.src=u;v.load();v.play().catch(function(){});document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){try{v.pause();}catch(e){}}},{passive:true});window.addEventListener('pagehide',function(){try{v.pause();v.removeAttribute('src');v.load();}catch(e){}},{passive:true});}catch(e){}</script></body></html>`;
  }, [url]);

  return (
    <iframe
      title="isolated-player"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; fullscreen; picture-in-picture"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'black',
      }}
    />
  );
}

export default IsolatedIframePlayer;
