import { ipcMain, BrowserWindow } from 'electron'

export interface VideoInfo {
  video: {
    codec_name: string
    width: number
    height: number
    pix_fmt?: string
    profile?: string
  }
  audio: {
    codec_name: string
    channels: number
    channel_layout?: string
    bit_rate?: string
  }
  bitrate: number
  duration: string
  container_extension: string
}

// We'll get VLC service from the handlers
let vlcServiceGetter: (() => any) | null = null

export function setVLCServiceGetter(getter: () => any) {
  vlcServiceGetter = getter
}

export function registerWebsiteHandlers(mainWindow: BrowserWindow): void {
  console.log('Registering website communication IPC handlers')

  // Handle play video request from website - directly open external VLC
  ipcMain.handle('website:play-video', async (event, videoUrl: string, videoInfo?: VideoInfo) => {
    try {
      console.log('🌐 [WEBSITE_HANDLER] Video playback request received from website:', videoUrl)
      console.log('🌐 [WEBSITE_HANDLER] Video info provided:', !!videoInfo)
      if (videoInfo) {
        console.log('🌐 [WEBSITE_HANDLER] Video details:', {
          codec: videoInfo.video.codec_name,
          resolution: `${videoInfo.video.width}x${videoInfo.video.height}`,
          audio: `${videoInfo.audio.codec_name} ${videoInfo.audio.channels}ch`,
        })
      }

      console.log('🌐 [WEBSITE_HANDLER] Opening video directly in external VLC...')
      
      // Get VLC service and directly call playVideoWithGUI
      if (vlcServiceGetter) {
        const vlcService = vlcServiceGetter()
        if (vlcService) {
          await vlcService.playVideoWithGUI(videoUrl)
          console.log('🌐 [WEBSITE_HANDLER] ✅ Video opened in external VLC successfully')
          return { success: true }
        } else {
          throw new Error('VLC service not available')
        }
      } else {
        throw new Error('VLC service getter not set')
      }
    } catch (error) {
      console.error('🌐 [WEBSITE_HANDLER] ❌ Failed to open video in external VLC:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Handle electron detection from website
  ipcMain.handle('website:is-electron', async () => {
    return { success: true, data: true }
  })

  // Handle get app info request
  ipcMain.handle('website:get-app-info', async () => {
    try {
      return {
        success: true,
        data: {
          name: 'Voddly Desktop',
          version: '1.0.0',
          platform: process.platform,
          isElectron: true,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Handle focus window request
  ipcMain.handle('website:focus-window', async () => {
    try {
      if (!mainWindow.isDestroyed()) {
        mainWindow.focus()
        mainWindow.show()
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  console.log('Website communication IPC handlers registered successfully')
}
