import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, createWriteStream, mkdirSync, chmodSync } from 'fs'
import { EventEmitter } from 'events'
import { createReadStream } from 'fs'
import * as http from 'http'
import * as https from 'https'

export interface VLCPlayerState {
  playing: boolean
  paused: boolean
  duration?: number
  currentTime?: number
  volume: number
  muted: boolean
  filename?: string
}

interface VLCDownloadInfo {
  url: string
  filename: string
  executable: string
  extract: boolean
}

export class VLCService extends EventEmitter {
  private vlcProcess: ChildProcess | null = null
  private httpPort = 8080
  private httpPassword = 'vlcpass123'
  private currentState: VLCPlayerState = {
    playing: false,
    paused: false,
    volume: 100,
    muted: false,
  }
  private isReady = false
  private isDownloading = false
  private vlcPath: string | null = null

  constructor() {
    super()
  }

  private getVLCDownloadInfo(): VLCDownloadInfo {
    const platform = process.platform
    const arch = process.arch

    switch (platform) {
      case 'darwin':
        if (arch === 'arm64') {
          return {
            url: 'https://download.videolan.org/pub/videolan/vlc/3.0.21/macosx/vlc-3.0.21-arm64.dmg',
            filename: 'vlc-arm64.dmg',
            executable: 'VLC.app/Contents/MacOS/VLC',
            extract: false, // DMG requires special handling
          }
        } else {
          return {
            url: 'https://download.videolan.org/pub/videolan/vlc/3.0.21/macosx/vlc-3.0.21-intel64.dmg',
            filename: 'vlc-intel.dmg',
            executable: 'VLC.app/Contents/MacOS/VLC',
            extract: false,
          }
        }

      case 'win32':
        return {
          url: 'https://download.videolan.org/pub/videolan/vlc/3.0.21/win64/vlc-3.0.21-win64.zip',
          filename: 'vlc-win64.zip',
          executable: 'vlc-3.0.21/vlc.exe',
          extract: true,
        }

      case 'linux':
        return {
          url: 'https://www.appimagehub.com/p/1039326', // This would need to be direct download link
          filename: 'vlc.AppImage',
          executable: 'vlc-wrapper.sh', // Use wrapper script
          extract: false,
        }

      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  private getVLCDir(): string {
    const resourcesPath =
      process.env.NODE_ENV === 'development' ? join(__dirname, '../../resources') : process.resourcesPath
    // Use platform-specific subdirectory
    return join(resourcesPath, 'vlc-binaries', process.platform)
  }

  private getVLCPath(): string {
    const vlcDir = this.getVLCDir()
    const downloadInfo = this.getVLCDownloadInfo()
    return join(vlcDir, downloadInfo.executable)
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http

      client
        .get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Handle redirect
            if (response.headers.location) {
              this.downloadFile(response.headers.location, outputPath).then(resolve).catch(reject)
              return
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status: ${response.statusCode}`))
            return
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10)
          let downloadedSize = 0

          const fileStream = createWriteStream(outputPath)

          response.on('data', (chunk) => {
            downloadedSize += chunk.length
            const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0
            this.emit('download-progress', {
              progress: Math.round(progress),
              downloaded: downloadedSize,
              total: totalSize,
            })
          })

          response.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close()
            resolve()
          })

          fileStream.on('error', (error) => {
            reject(error)
          })
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  }

  private async extractArchive(archivePath: string, extractPath: string): Promise<void> {
    const downloadInfo = this.getVLCDownloadInfo()

    if (downloadInfo.filename.endsWith('.zip')) {
      // Extract ZIP file - dynamically import extract-zip only when needed
      return new Promise((resolve, reject) => {
        try {
          const Extract = require('extract-zip')
          createReadStream(archivePath)
            .pipe(Extract({ path: extractPath }))
            .on('close', resolve)
            .on('error', reject)
        } catch (error) {
          // If extract-zip is not available, use native unzip command as fallback
          const { exec } = require('child_process')
          exec(`unzip -o "${archivePath}" -d "${extractPath}"`, (execError) => {
            if (execError) reject(execError)
            else resolve()
          })
        }
      })
    } else if (downloadInfo.filename.endsWith('.tar.xz')) {
      // Extract tar.xz (for Linux)
      const { exec } = require('child_process')
      return new Promise((resolve, reject) => {
        exec(`tar -xf "${archivePath}" -C "${extractPath}"`, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    } else if (downloadInfo.filename.endsWith('.dmg')) {
      // For macOS DMG, we need special handling
      const { exec } = require('child_process')
      return new Promise((resolve, reject) => {
        const mountPoint = '/tmp/vlc-mount'
        exec(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}"`, (error) => {
          if (error) {
            reject(error)
            return
          }

          // Copy VLC.app from mounted DMG
          exec(`cp -R "${mountPoint}/VLC.app" "${extractPath}/"`, (copyError) => {
            // Unmount DMG
            exec(`hdiutil detach "${mountPoint}"`, () => {
              if (copyError) reject(copyError)
              else resolve()
            })
          })
        })
      })
    }
  }

  private async ensureVLCInstalled(): Promise<string> {
    if (this.vlcPath && existsSync(this.vlcPath)) {
      return this.vlcPath
    }

    // Try multiple VLC locations in priority order
    const possiblePaths = this.getVLCPossiblePaths()

    console.log('Looking for VLC in these locations:', possiblePaths)

    for (const vlcPath of possiblePaths) {
      console.log(`Checking VLC path: ${vlcPath} - exists: ${existsSync(vlcPath)}`)
      if (existsSync(vlcPath)) {
        console.log(`Found VLC at: ${vlcPath}`)
        this.vlcPath = vlcPath
        return vlcPath
      }
    }

    // If no VLC found, provide helpful instructions
    const instructions = this.getVLCInstallInstructions()
    throw new Error(
      `VLC not found. Please install VLC:\n\n${instructions}\n\nTried these paths:\n${possiblePaths.join('\n')}`
    )
  }

  private getVLCPossiblePaths(): string[] {
    const platform = process.platform
    const paths: string[] = []

    // First check bundled/manual locations in app resources
    const vlcDir = this.getVLCDir()
    const bundledPath = this.getVLCPath()
    paths.push(bundledPath)

    // Then check system installations
    switch (platform) {
      case 'darwin':
        paths.push(
          '/Applications/VLC.app/Contents/MacOS/VLC',
          '/usr/local/bin/vlc',
          join(process.env.HOME || '', 'Applications/VLC.app/Contents/MacOS/VLC')
        )
        break

      case 'win32':
        paths.push(
          'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
          'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
          join(process.env.LOCALAPPDATA || '', 'Programs\\VLC\\vlc.exe')
        )
        break

      case 'linux':
        paths.push('/usr/bin/vlc', '/usr/local/bin/vlc', '/snap/bin/vlc', '/opt/vlc/bin/vlc')
        break
    }

    return paths.filter((path) => path) // Remove any undefined paths
  }

  private getVLCInstallInstructions(): string {
    const platform = process.platform
    const vlcDir = this.getVLCDir()

    switch (platform) {
      case 'darwin':
        return `macOS Instructions:
1. Download VLC from: https://www.videolan.org/vlc/download-macos.html
2. Install VLC.app to /Applications/
   OR
3. Extract VLC.app to: ${vlcDir}/VLC.app`

      case 'win32':
        return `Windows Instructions:
1. Download VLC from: https://www.videolan.org/vlc/download-windows.html
2. Install VLC normally
   OR
3. Extract vlc-3.0.21/ folder to: ${vlcDir}/vlc-3.0.21/`

      case 'linux':
        return `Linux Instructions:
1. Install via package manager: sudo apt install vlc
   OR
2. Download from: https://www.videolan.org/vlc/download-ubuntu.html
   OR
3. Extract vlc-3.0.21/ folder to: ${vlcDir}/vlc-3.0.21/`

      default:
        return 'Please install VLC media player from https://www.videolan.org/'
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing VLC service...')
      this.vlcPath = await this.ensureVLCInstalled()
      console.log('VLC ready at:', this.vlcPath)
      this.emit('ready')
    } catch (error) {
      console.error('Failed to initialize VLC:', error)
      throw error
    }
  }

  async playVideoWithGUI(videoPath: string): Promise<void> {
    try {
      // Ensure VLC is installed
      const vlcPath = await this.ensureVLCInstalled()

      // Kill any existing process
      if (this.vlcProcess) {
        this.vlcProcess.kill()
        this.vlcProcess = null
      }

      console.log('Starting VLC with full GUI for video:', videoPath)

      // Start VLC with full GUI in windowed mode
      this.vlcProcess = spawn(
        vlcPath,
        [
          '--no-video-title-show', // Don't show title overlay
          '--video-on-top', // Keep video window on top initially
          videoPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
        }
      )

      if (!this.vlcProcess) {
        throw new Error('Failed to start VLC process')
      }

      this.vlcProcess.on('error', (error) => {
        console.error('VLC process error:', error)
        this.emit('error', error)
      })

      this.vlcProcess.on('exit', (code, signal) => {
        console.log(`VLC process exited with code: ${code}, signal: ${signal}`)
        this.isReady = false
        this.currentState.playing = false
        this.currentState.paused = false
        this.emit('exit', { code, signal })
      })

      this.currentState.filename = videoPath
      this.currentState.playing = true
      this.currentState.paused = false
      this.isReady = true

      this.emit('loaded', { filename: videoPath })
    } catch (error) {
      console.error('Failed to play video in VLC:', error)
      throw error
    }
  }

  async loadVideo(videoPath: string): Promise<void> {
    try {
      // Ensure VLC is installed
      const vlcPath = await this.ensureVLCInstalled()

      // Kill any existing process
      if (this.vlcProcess) {
        this.vlcProcess.kill()
        this.vlcProcess = null
      }

      console.log('Starting VLC with video:', videoPath)

      // Start VLC with HTTP interface and visible video
      this.vlcProcess = spawn(
        vlcPath,
        [
          '--intf',
          'http', // Enable HTTP interface
          '--extraintf',
          'macosx', // Also enable macOS interface for video display
          '--http-host',
          '127.0.0.1', // Bind to localhost
          '--http-port',
          this.httpPort.toString(), // HTTP port
          '--http-password',
          this.httpPassword, // Password for HTTP interface
          '--no-video-title-show', // Don't show title overlay
          '--sub-track',
          '0', // Start with subtitles disabled
          '--no-random', // Don't shuffle
          '--no-loop', // Don't loop
          '--no-repeat', // Don't repeat
          '--video-on-top', // Keep video window on top
          videoPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
        }
      )

      if (!this.vlcProcess) {
        throw new Error('Failed to start VLC process')
      }

      this.vlcProcess.on('error', (error) => {
        console.error('VLC process error:', error)
        this.emit('error', error)
      })

      this.vlcProcess.on('exit', (code, signal) => {
        console.log(`VLC process exited with code: ${code}, signal: ${signal}`)
        this.isReady = false
        this.currentState.playing = false
        this.currentState.paused = false
        this.emit('exit', { code, signal })
      })

      this.vlcProcess.stdout?.on('data', (data) => {
        console.log('VLC stdout:', data.toString())
      })

      this.vlcProcess.stderr?.on('data', (data) => {
        console.log('VLC stderr:', data.toString())
      })

      // Wait for VLC HTTP interface to be ready
      await this.waitForHTTPInterface()

      this.currentState.filename = videoPath
      this.currentState.playing = false
      this.currentState.paused = true
      this.isReady = true

      this.emit('loaded', { filename: videoPath })
    } catch (error) {
      console.error('Failed to load video in VLC:', error)
      throw error
    }
  }

  private async waitForHTTPInterface(): Promise<void> {
    const maxAttempts = 30 // 15 seconds max
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.httpPort}/requests/status.xml`, {
          headers: {
            Authorization: 'Basic ' + Buffer.from(`:${this.httpPassword}`).toString('base64'),
          },
        })

        if (response.ok) {
          console.log('VLC HTTP interface ready')
          return
        }
      } catch (error) {
        // Interface not ready yet
      }

      attempts++
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error('VLC HTTP interface failed to start')
  }

  private async vlcCommand(command: string): Promise<any> {
    if (!this.isReady) {
      throw new Error('VLC not ready')
    }

    try {
      const response = await fetch(`http://127.0.0.1:${this.httpPort}/requests/status.xml?command=${command}`, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`:${this.httpPassword}`).toString('base64'),
        },
      })

      if (!response.ok) {
        throw new Error(`VLC command failed: ${response.statusText}`)
      }

      return await response.text()
    } catch (error) {
      console.error('VLC command error:', error)
      throw error
    }
  }

  async play(): Promise<void> {
    try {
      await this.vlcCommand('pl_play')
      this.currentState.playing = true
      this.currentState.paused = false
      this.emit('play')
    } catch (error) {
      console.error('Failed to play:', error)
      throw error
    }
  }

  async pause(): Promise<void> {
    try {
      await this.vlcCommand('pl_pause')
      this.currentState.playing = false
      this.currentState.paused = true
      this.emit('pause')
    } catch (error) {
      console.error('Failed to pause:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    try {
      await this.vlcCommand('pl_stop')
      this.currentState.playing = false
      this.currentState.paused = false
      this.emit('stop')
    } catch (error) {
      console.error('Failed to stop:', error)
      throw error
    }
  }

  async seek(seconds: number): Promise<void> {
    try {
      await this.vlcCommand(`seek&val=${seconds}`)
      this.currentState.currentTime = seconds
      this.emit('seek', seconds)
    } catch (error) {
      console.error('Failed to seek:', error)
      throw error
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      const vol = Math.max(0, Math.min(100, volume))
      await this.vlcCommand(`volume&val=${(vol / 100) * 256}`) // VLC uses 0-256 range
      this.currentState.volume = vol
      this.emit('volumeChange', vol)
    } catch (error) {
      console.error('Failed to set volume:', error)
      throw error
    }
  }

  // Subtitle controls that actually work!
  async enableSubtitles(trackId?: number): Promise<void> {
    try {
      const track = trackId || 1
      await this.vlcCommand(`spu_track&val=${track}`)
      this.emit('subtitles-enabled', track)
    } catch (error) {
      console.error('Failed to enable subtitles:', error)
      throw error
    }
  }

  async disableSubtitles(): Promise<void> {
    try {
      await this.vlcCommand('spu_track&val=-1')
      this.emit('subtitles-disabled')
    } catch (error) {
      console.error('Failed to disable subtitles:', error)
      throw error
    }
  }

  async getSubtitleTracks(): Promise<any[]> {
    try {
      // VLC HTTP interface provides subtitle track info in status
      const status = await this.vlcCommand('')
      // Parse XML response to extract subtitle tracks
      // This is a simplified version - you'd want proper XML parsing
      return []
    } catch (error) {
      console.error('Failed to get subtitle tracks:', error)
      return []
    }
  }

  getState(): VLCPlayerState {
    return { ...this.currentState }
  }

  async createStreamingPlayer(videoPath: string, port = 8081): Promise<void> {
    try {
      const vlcPath = await this.ensureVLCInstalled()

      // Kill any existing process
      if (this.vlcProcess) {
        this.vlcProcess.kill()
        this.vlcProcess = null
      }

      console.log('Starting VLC with web interface on port 8080 for:', videoPath)

      // Start VLC with HTTP interface only (simpler approach)
      this.vlcProcess = spawn(
        vlcPath,
        [
          '--intf',
          'http', // HTTP web interface
          '--http-host',
          '0.0.0.0', // Accept connections from anywhere
          '--http-port',
          '8080', // Web interface port
          '--http-password',
          'vlcpass', // Set password for web interface
          '--no-video-title-show',
          videoPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      )

      if (!this.vlcProcess) {
        throw new Error('Failed to start VLC streaming process')
      }

      this.vlcProcess.on('error', (error) => {
        console.error('VLC streaming error:', error)
        this.emit('error', error)
      })

      this.vlcProcess.on('exit', (code, signal) => {
        console.log(`VLC streaming process exited with code: ${code}, signal: ${signal}`)
        this.isReady = false
        this.emit('exit', { code, signal })
      })

      this.vlcProcess.stdout?.on('data', (data) => {
        console.log('VLC streaming stdout:', data.toString())
      })

      this.vlcProcess.stderr?.on('data', (data) => {
        console.log('VLC streaming stderr:', data.toString())
      })

      this.currentState.filename = videoPath
      this.currentState.playing = true
      this.isReady = true

      this.emit('streaming-started', { port, videoPath })
    } catch (error) {
      console.error('Failed to create VLC streaming player:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    if (this.vlcProcess) {
      this.vlcProcess.kill()
      this.vlcProcess = null
    }
    this.isReady = false
  }
}
