import { BrowserWindow, shell, app } from 'electron'
import { join } from 'path'
import appIcon from '@/resources/build/icon.png?asset'
import { registerResourcesProtocol } from './protocols'
import { registerWindowHandlers } from '@/lib/conveyor/handlers/window-handler'
import { registerAppHandlers } from '@/lib/conveyor/handlers/app-handler'
import { registerWebsiteHandlers } from './website-handlers'

export async function createAppWindow(): Promise<void> {
  // Register resources protocol
  registerResourcesProtocol()

  // Create the main window with 16:9 aspect ratio
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    show: false,
    backgroundColor: '#1c1c1c',
    icon: appIcon,
    frame: false,
    titleBarStyle: 'hiddenInset',
    title: 'Voddly Desktop',
    maximizable: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      experimentalFeatures: true,      // Enable experimental web features
      webSecurity: false,              // Disable web security for external video streams
      allowRunningInsecureContent: true, // Allow HTTP content in HTTPS context
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Configure session permissions for media access
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow all media permissions for video playback
    if (permission === 'media' || permission === 'mediaKeySystem') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Set permissive CSP for media loading
  mainWindow.webContents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src * data: blob: filesystem: about: ws: wss: \'unsafe-inline\' \'unsafe-eval\'; script-src * data: blob: \'unsafe-inline\' \'unsafe-eval\'; connect-src * data: blob: \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src * data: blob:; style-src * data: blob: \'unsafe-inline\'; font-src * data: blob: \'unsafe-inline\'; media-src * data: blob: \'unsafe-inline\';']
      }
    })
  })

  // Set user agent to avoid potential blocking
  mainWindow.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')

  // Register IPC events for the main window.
  registerWindowHandlers(mainWindow)
  registerAppHandlers(app)
  registerWebsiteHandlers(mainWindow)

  // Maintain 16:9 aspect ratio when resizing
  mainWindow.on('will-resize', (event, newBounds) => {
    const aspectRatio = 16 / 9
    const newWidth = newBounds.width
    const newHeight = Math.round(newWidth / aspectRatio)

    // Update the bounds to maintain aspect ratio
    newBounds.height = newHeight
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Cleanup when window is closing
  mainWindow.on('close', () => {
    console.log('🧹 [APP] Window closing...')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the React renderer
  if (!app.isPackaged) {
    // Development: Load from electron-vite dev server
    if (process.env['ELECTRON_RENDERER_URL']) {
      await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
      console.log('✅ Loaded React renderer from dev server')
    } else {
      await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
      console.log('✅ Loaded React renderer from file')
    }
  } else {
    // Production: Load local files
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    console.log('✅ Loaded React renderer from file (production)')
  }
}
