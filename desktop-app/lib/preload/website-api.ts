import { ipcRenderer } from 'electron'

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

export interface WebsiteApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  isElectron: boolean
}

export interface PlayVideoRequest {
  url: string
  videoInfo?: VideoInfo
}

export const websiteApi = {
  /**
   * Check if running in Electron
   */
  async isElectron(): Promise<WebsiteApiResponse<boolean>> {
    try {
      return await ipcRenderer.invoke('website:is-electron')
    } catch (error) {
      return { success: false, error: 'Not in Electron environment' }
    }
  },

  /**
   * Get app information
   */
  async getAppInfo(): Promise<WebsiteApiResponse<AppInfo>> {
    return await ipcRenderer.invoke('website:get-app-info')
  },

  /**
   * Request video playback in Electron app
   */
  async playVideo(videoUrl: string, videoInfo?: VideoInfo): Promise<WebsiteApiResponse> {
    return await ipcRenderer.invoke('website:play-video', videoUrl, videoInfo)
  },

  /**
   * Focus the Electron window
   */
  async focusWindow(): Promise<WebsiteApiResponse> {
    return await ipcRenderer.invoke('website:focus-window')
  },

  /**
   * Listen for video playback requests from website
   */
  onPlayVideoRequest(callback: (request: PlayVideoRequest) => void): () => void {
    const handler = (_event: any, request: PlayVideoRequest) => {
      callback(request)
    }

    ipcRenderer.on('website:play-video-request', handler)

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('website:play-video-request', handler)
    }
  },

  /**
   * Simple detection method for websites
   */
  detectElectron(): boolean {
    return typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer'
  },
}

