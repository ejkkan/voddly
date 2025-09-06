import { useEffect, useRef } from 'react'
import './styles/app.css'

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    // Setup postMessage communication with iframe
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from localhost:8081 (your Expo app)
      if (event.origin !== 'http://localhost:8081') return
      
      if (event.data.type === 'PLAY_VIDEO') {
        console.log('🎬 Received video play request from Expo app:', event.data.payload)
        
        // Forward to Electron's video API - this will open external VLC
        if (window.websiteApi?.playVideo) {
          window.websiteApi.playVideo(event.data.payload.url, event.data.payload.videoInfo)
            .then((result) => {
              console.log('✅ Video sent to external VLC player:', result)
              // No UI change - stay on the web app view
            })
            .catch((error) => {
              console.error('❌ Failed to play video in external VLC:', error)
            })
        }
      } else if (event.data.type === 'CHECK_ELECTRON') {
        // Respond to Expo app that we're running in Electron
        const iframe = iframeRef.current
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'ELECTRON_RESPONSE',
            payload: { 
              isElectron: true,
              appName: 'Voddly Desktop'
            }
          }, 'http://localhost:8081')
        }
      }
    }

    window.addEventListener('message', handleMessage)
    
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  return (
    <div className="h-screen">
      <iframe
        ref={iframeRef}
        src="http://localhost:8081"
        className="w-full h-full border-0"
        title="Voddly Web App"
      />
    </div>
  )
}
