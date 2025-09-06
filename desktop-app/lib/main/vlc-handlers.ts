import { ipcMain } from 'electron'
import { VLCService } from './vlc-service'
import { setVLCServiceGetter } from './website-handlers'

let vlcService: VLCService | null = null

// Initialize VLC handlers
export function setupVLCHandlers() {
  vlcService = new VLCService()
  
  // Set up getter for website handlers to access VLC service
  setVLCServiceGetter(() => vlcService)

  // VLC Service Events
  vlcService.on('ready', () => {
    console.log('VLC service is ready')
  })

  vlcService.on('error', (error) => {
    console.error('VLC service error:', error)
  })

  vlcService.on('loaded', (data) => {
    console.log('VLC loaded video:', data)
  })

  vlcService.on('play', () => {
    console.log('VLC started playing')
  })

  vlcService.on('pause', () => {
    console.log('VLC paused')
  })

  vlcService.on('stop', () => {
    console.log('VLC stopped')
  })

  // IPC Handlers for renderer process communication
  ipcMain.handle('vlc:initialize', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.initialize()
      return { success: true }
    } catch (error: any) {
      console.error('Failed to initialize VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:load-video', async (event, videoPath: string) => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.loadVideo(videoPath)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to load video in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:play-video-gui', async (event, videoPath: string) => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.playVideoWithGUI(videoPath)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to play video with GUI in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:play', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.play()
      return { success: true }
    } catch (error: any) {
      console.error('Failed to play in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:pause', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.pause()
      return { success: true }
    } catch (error: any) {
      console.error('Failed to pause in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:stop', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.stop()
      return { success: true }
    } catch (error: any) {
      console.error('Failed to stop in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:seek', async (event, seconds: number) => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.seek(seconds)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to seek in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:set-volume', async (event, volume: number) => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.setVolume(volume)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to set volume in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:enable-subtitles', async (event, trackId?: number) => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.enableSubtitles(trackId)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to enable subtitles in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:disable-subtitles', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.disableSubtitles()
      return { success: true }
    } catch (error: any) {
      console.error('Failed to disable subtitles in VLC:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:get-subtitle-tracks', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      const tracks = await vlcService.getSubtitleTracks()
      return { success: true, tracks }
    } catch (error: any) {
      console.error('Failed to get subtitle tracks in VLC:', error)
      return { success: false, error: error.message, tracks: [] }
    }
  })

  ipcMain.handle('vlc:get-state', async () => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      const state = vlcService.getState()
      return { success: true, state }
    } catch (error: any) {
      console.error('Failed to get VLC state:', error)
      return { success: false, error: error.message, state: null }
    }
  })

  ipcMain.handle('vlc:create-stream', async (event, videoPath: string, port: number = 8081) => {
    try {
      if (!vlcService) {
        throw new Error('VLC service not available')
      }
      await vlcService.createStreamingPlayer(videoPath, port)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to create VLC stream:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vlc:cleanup', async () => {
    try {
      if (vlcService) {
        await vlcService.cleanup()
      }
      return { success: true }
    } catch (error: any) {
      console.error('Failed to cleanup VLC:', error)
      return { success: false, error: error.message }
    }
  })
}

// Cleanup function
export async function cleanupVLC() {
  if (vlcService) {
    await vlcService.cleanup()
    vlcService = null
  }
}