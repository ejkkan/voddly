"use strict";
const electron = require("electron");
const utils = require("@electron-toolkit/utils");
const path = require("path");
const url = require("url");
const zod = require("zod");
const preload = require("@electron-toolkit/preload");
const child_process = require("child_process");
const fs = require("fs");
const events = require("events");
const http = require("http");
const https = require("https");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const http__namespace = /* @__PURE__ */ _interopNamespaceDefault(http);
const https__namespace = /* @__PURE__ */ _interopNamespaceDefault(https);
const appIcon = path.join(__dirname, "../../resources/build/icon.png");
function registerResourcesProtocol() {
  electron.protocol.handle("res", async (request) => {
    try {
      const url$1 = new URL(request.url);
      const fullPath = path.join(url$1.hostname, url$1.pathname.slice(1));
      const filePath = path.join(__dirname, "../../resources", fullPath);
      return electron.net.fetch(url.pathToFileURL(filePath).toString());
    } catch (error) {
      console.error("Protocol error:", error);
      return new Response("Resource not found", { status: 404 });
    }
  });
}
const windowIpcSchema = {
  "window-init": {
    args: zod.z.tuple([]),
    return: zod.z.object({
      width: zod.z.number(),
      height: zod.z.number(),
      minimizable: zod.z.boolean(),
      maximizable: zod.z.boolean(),
      platform: zod.z.string()
    })
  },
  "window-is-minimizable": {
    args: zod.z.tuple([]),
    return: zod.z.boolean()
  },
  "window-is-maximizable": {
    args: zod.z.tuple([]),
    return: zod.z.boolean()
  },
  "window-minimize": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "window-maximize": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "window-close": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "window-maximize-toggle": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  // Web content operations
  "web-undo": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-redo": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-cut": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-copy": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-paste": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-delete": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-select-all": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-reload": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-force-reload": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-toggle-devtools": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-actual-size": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-zoom-in": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-zoom-out": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-toggle-fullscreen": {
    args: zod.z.tuple([]),
    return: zod.z.void()
  },
  "web-open-url": {
    args: zod.z.tuple([zod.z.string()]),
    return: zod.z.void()
  },
  "web-open-fullscreen-browser": {
    args: zod.z.tuple([zod.z.string()]),
    return: zod.z.number()
  },
  "web-close-browser-view": {
    args: zod.z.tuple([]),
    return: zod.z.boolean()
  }
};
const appIpcSchema = {
  version: {
    args: zod.z.tuple([]),
    return: zod.z.string()
  }
};
const ipcSchemas = {
  ...windowIpcSchema,
  ...appIpcSchema
};
const validateArgs = (channel, args) => {
  return ipcSchemas[channel].args.parse(args);
};
const validateReturn = (channel, data) => {
  return ipcSchemas[channel].return.parse(data);
};
const handle = (channel, handler) => {
  electron.ipcMain.handle(channel, async (_, ...args) => {
    try {
      const validatedArgs = validateArgs(channel, args);
      const result = await handler(...validatedArgs);
      return validateReturn(channel, result);
    } catch (error) {
      console.error(`IPC Error in ${channel}:`, error);
      throw error;
    }
  });
};
const registerWindowHandlers = (window) => {
  handle("window-init", () => {
    const { width, height } = window.getBounds();
    const minimizable = window.isMinimizable();
    const maximizable = window.isMaximizable();
    const platform = preload.electronAPI.process.platform;
    return { width, height, minimizable, maximizable, platform };
  });
  handle("window-is-minimizable", () => window.isMinimizable());
  handle("window-is-maximizable", () => window.isMaximizable());
  handle("window-minimize", () => window.minimize());
  handle("window-maximize", () => window.maximize());
  handle("window-close", () => window.close());
  handle("window-maximize-toggle", () => window.isMaximized() ? window.unmaximize() : window.maximize());
  const webContents = window.webContents;
  handle("web-undo", () => webContents.undo());
  handle("web-redo", () => webContents.redo());
  handle("web-cut", () => webContents.cut());
  handle("web-copy", () => webContents.copy());
  handle("web-paste", () => webContents.paste());
  handle("web-delete", () => webContents.delete());
  handle("web-select-all", () => webContents.selectAll());
  handle("web-reload", () => webContents.reload());
  handle("web-force-reload", () => webContents.reloadIgnoringCache());
  handle("web-toggle-devtools", () => webContents.toggleDevTools());
  handle("web-actual-size", () => webContents.setZoomLevel(0));
  handle("web-zoom-in", () => webContents.setZoomLevel(webContents.zoomLevel + 0.5));
  handle("web-zoom-out", () => webContents.setZoomLevel(webContents.zoomLevel - 0.5));
  handle("web-toggle-fullscreen", () => window.setFullScreen(!window.fullScreen));
  handle("web-open-url", (url2) => electron.shell.openExternal(url2));
  handle("web-open-fullscreen-browser", (url2) => {
    const browserView = new electron.BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });
    window.setBrowserView(browserView);
    const bounds = window.getContentBounds();
    browserView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height
    });
    browserView.setAutoResize({
      width: true,
      height: true
    });
    browserView.webContents.loadURL(url2);
    return window.id;
  });
  handle("web-close-browser-view", () => {
    window.setBrowserView(null);
    return true;
  });
};
const registerAppHandlers = (app) => {
  handle("version", () => app.getVersion());
};
let vlcServiceGetter = null;
function setVLCServiceGetter(getter) {
  vlcServiceGetter = getter;
}
function registerWebsiteHandlers(mainWindow) {
  console.log("Registering website communication IPC handlers");
  electron.ipcMain.handle("website:play-video", async (event, videoUrl, videoInfo) => {
    try {
      console.log("🌐 [WEBSITE_HANDLER] Video playback request received from website:", videoUrl);
      console.log("🌐 [WEBSITE_HANDLER] Video info provided:", !!videoInfo);
      if (videoInfo) {
        console.log("🌐 [WEBSITE_HANDLER] Video details:", {
          codec: videoInfo.video.codec_name,
          resolution: `${videoInfo.video.width}x${videoInfo.video.height}`,
          audio: `${videoInfo.audio.codec_name} ${videoInfo.audio.channels}ch`
        });
      }
      console.log("🌐 [WEBSITE_HANDLER] Opening video directly in external VLC...");
      if (vlcServiceGetter) {
        const vlcService2 = vlcServiceGetter();
        if (vlcService2) {
          await vlcService2.playVideoWithGUI(videoUrl);
          console.log("🌐 [WEBSITE_HANDLER] ✅ Video opened in external VLC successfully");
          return { success: true };
        } else {
          throw new Error("VLC service not available");
        }
      } else {
        throw new Error("VLC service getter not set");
      }
    } catch (error) {
      console.error("🌐 [WEBSITE_HANDLER] ❌ Failed to open video in external VLC:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  electron.ipcMain.handle("website:is-electron", async () => {
    return { success: true, data: true };
  });
  electron.ipcMain.handle("website:get-app-info", async () => {
    try {
      return {
        success: true,
        data: {
          name: "Voddly Desktop",
          version: "1.0.0",
          platform: process.platform,
          isElectron: true
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  electron.ipcMain.handle("website:focus-window", async () => {
    try {
      if (!mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.show();
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });
  console.log("Website communication IPC handlers registered successfully");
}
async function createAppWindow() {
  registerResourcesProtocol();
  const mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    show: false,
    backgroundColor: "#1c1c1c",
    icon: appIcon,
    frame: false,
    titleBarStyle: "hiddenInset",
    title: "Voddly Desktop",
    maximizable: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: false,
      experimentalFeatures: true,
      // Enable experimental web features
      webSecurity: false,
      // Disable web security for external video streams
      allowRunningInsecureContent: true,
      // Allow HTTP content in HTTPS context
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const session = mainWindow.webContents.session;
  session.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
  console.log("[Electron] Configuring session for cross-origin cookies...");
  session.cookies.flushStore();
  session.setPermissionCheckHandler(() => true);
  session.setDevicePermissionHandler(() => true);
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "mediaKeySystem") {
      callback(true);
    } else {
      callback(false);
    }
  });
  mainWindow.webContents.session.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src * data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src * data: blob: 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src * data: blob:; style-src * data: blob: 'unsafe-inline'; font-src * data: blob: 'unsafe-inline'; media-src * data: blob: 'unsafe-inline';"]
      }
    });
  });
  mainWindow.webContents.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
  registerWindowHandlers(mainWindow);
  registerAppHandlers(electron.app);
  registerWebsiteHandlers(mainWindow);
  mainWindow.on("will-resize", (event, newBounds) => {
    const aspectRatio = 16 / 9;
    const newWidth = newBounds.width;
    const newHeight = Math.round(newWidth / aspectRatio);
    newBounds.height = newHeight;
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.on("close", () => {
    console.log("🧹 [APP] Window closing...");
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (!electron.app.isPackaged) {
    if (process.env["ELECTRON_RENDERER_URL"]) {
      await mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
      console.log("✅ Loaded React renderer from dev server");
    } else {
      await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
      console.log("✅ Loaded React renderer from file");
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    console.log("✅ Loaded React renderer from file (production)");
  }
}
class VLCService extends events.EventEmitter {
  vlcProcess = null;
  httpPort = 8080;
  httpPassword = "vlcpass123";
  currentState = {
    playing: false,
    paused: false,
    volume: 100,
    muted: false
  };
  isReady = false;
  isDownloading = false;
  vlcPath = null;
  constructor() {
    super();
  }
  getVLCDownloadInfo() {
    const platform = process.platform;
    const arch = process.arch;
    switch (platform) {
      case "darwin":
        if (arch === "arm64") {
          return {
            url: "https://download.videolan.org/pub/videolan/vlc/3.0.21/macosx/vlc-3.0.21-arm64.dmg",
            filename: "vlc-arm64.dmg",
            executable: "VLC.app/Contents/MacOS/VLC",
            extract: false
            // DMG requires special handling
          };
        } else {
          return {
            url: "https://download.videolan.org/pub/videolan/vlc/3.0.21/macosx/vlc-3.0.21-intel64.dmg",
            filename: "vlc-intel.dmg",
            executable: "VLC.app/Contents/MacOS/VLC",
            extract: false
          };
        }
      case "win32":
        return {
          url: "https://download.videolan.org/pub/videolan/vlc/3.0.21/win64/vlc-3.0.21-win64.zip",
          filename: "vlc-win64.zip",
          executable: "vlc-3.0.21/vlc.exe",
          extract: true
        };
      case "linux":
        return {
          url: "https://www.appimagehub.com/p/1039326",
          // This would need to be direct download link
          filename: "vlc.AppImage",
          executable: "vlc-wrapper.sh",
          // Use wrapper script
          extract: false
        };
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  getVLCDir() {
    const resourcesPath = process.env.NODE_ENV === "development" ? path.join(__dirname, "../../resources") : process.resourcesPath;
    return path.join(resourcesPath, "vlc-binaries", process.platform);
  }
  getVLCPath() {
    const vlcDir = this.getVLCDir();
    const downloadInfo = this.getVLCDownloadInfo();
    return path.join(vlcDir, downloadInfo.executable);
  }
  async downloadFile(url2, outputPath) {
    return new Promise((resolve, reject) => {
      const client = url2.startsWith("https") ? https__namespace : http__namespace;
      client.get(url2, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          if (response.headers.location) {
            this.downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
            return;
          }
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status: ${response.statusCode}`));
          return;
        }
        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;
        const fileStream = fs.createWriteStream(outputPath);
        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          const progress = totalSize > 0 ? downloadedSize / totalSize * 100 : 0;
          this.emit("download-progress", {
            progress: Math.round(progress),
            downloaded: downloadedSize,
            total: totalSize
          });
        });
        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve();
        });
        fileStream.on("error", (error) => {
          reject(error);
        });
      }).on("error", (error) => {
        reject(error);
      });
    });
  }
  async extractArchive(archivePath, extractPath) {
    const downloadInfo = this.getVLCDownloadInfo();
    if (downloadInfo.filename.endsWith(".zip")) {
      return new Promise((resolve, reject) => {
        try {
          const Extract = require("extract-zip");
          fs.createReadStream(archivePath).pipe(Extract({ path: extractPath })).on("close", resolve).on("error", reject);
        } catch (error) {
          const { exec } = require("child_process");
          exec(`unzip -o "${archivePath}" -d "${extractPath}"`, (execError) => {
            if (execError) reject(execError);
            else resolve();
          });
        }
      });
    } else if (downloadInfo.filename.endsWith(".tar.xz")) {
      const { exec } = require("child_process");
      return new Promise((resolve, reject) => {
        exec(`tar -xf "${archivePath}" -C "${extractPath}"`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } else if (downloadInfo.filename.endsWith(".dmg")) {
      const { exec } = require("child_process");
      return new Promise((resolve, reject) => {
        const mountPoint = "/tmp/vlc-mount";
        exec(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}"`, (error) => {
          if (error) {
            reject(error);
            return;
          }
          exec(`cp -R "${mountPoint}/VLC.app" "${extractPath}/"`, (copyError) => {
            exec(`hdiutil detach "${mountPoint}"`, () => {
              if (copyError) reject(copyError);
              else resolve();
            });
          });
        });
      });
    }
  }
  async ensureVLCInstalled() {
    if (this.vlcPath && fs.existsSync(this.vlcPath)) {
      return this.vlcPath;
    }
    const possiblePaths = this.getVLCPossiblePaths();
    console.log("Looking for VLC in these locations:", possiblePaths);
    for (const vlcPath of possiblePaths) {
      console.log(`Checking VLC path: ${vlcPath} - exists: ${fs.existsSync(vlcPath)}`);
      if (fs.existsSync(vlcPath)) {
        console.log(`Found VLC at: ${vlcPath}`);
        this.vlcPath = vlcPath;
        return vlcPath;
      }
    }
    const instructions = this.getVLCInstallInstructions();
    throw new Error(
      `VLC not found. Please install VLC:

${instructions}

Tried these paths:
${possiblePaths.join("\n")}`
    );
  }
  getVLCPossiblePaths() {
    const platform = process.platform;
    const paths = [];
    this.getVLCDir();
    const bundledPath = this.getVLCPath();
    paths.push(bundledPath);
    switch (platform) {
      case "darwin":
        paths.push(
          "/Applications/VLC.app/Contents/MacOS/VLC",
          "/usr/local/bin/vlc",
          path.join(process.env.HOME || "", "Applications/VLC.app/Contents/MacOS/VLC")
        );
        break;
      case "win32":
        paths.push(
          "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
          "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
          path.join(process.env.LOCALAPPDATA || "", "Programs\\VLC\\vlc.exe")
        );
        break;
      case "linux":
        paths.push("/usr/bin/vlc", "/usr/local/bin/vlc", "/snap/bin/vlc", "/opt/vlc/bin/vlc");
        break;
    }
    return paths.filter((path2) => path2);
  }
  getVLCInstallInstructions() {
    const platform = process.platform;
    const vlcDir = this.getVLCDir();
    switch (platform) {
      case "darwin":
        return `macOS Instructions:
1. Download VLC from: https://www.videolan.org/vlc/download-macos.html
2. Install VLC.app to /Applications/
   OR
3. Extract VLC.app to: ${vlcDir}/VLC.app`;
      case "win32":
        return `Windows Instructions:
1. Download VLC from: https://www.videolan.org/vlc/download-windows.html
2. Install VLC normally
   OR
3. Extract vlc-3.0.21/ folder to: ${vlcDir}/vlc-3.0.21/`;
      case "linux":
        return `Linux Instructions:
1. Install via package manager: sudo apt install vlc
   OR
2. Download from: https://www.videolan.org/vlc/download-ubuntu.html
   OR
3. Extract vlc-3.0.21/ folder to: ${vlcDir}/vlc-3.0.21/`;
      default:
        return "Please install VLC media player from https://www.videolan.org/";
    }
  }
  async initialize() {
    try {
      console.log("Initializing VLC service...");
      this.vlcPath = await this.ensureVLCInstalled();
      console.log("VLC ready at:", this.vlcPath);
      this.emit("ready");
    } catch (error) {
      console.error("Failed to initialize VLC:", error);
      throw error;
    }
  }
  async playVideoWithGUI(videoPath) {
    try {
      const vlcPath = await this.ensureVLCInstalled();
      if (this.vlcProcess) {
        this.vlcProcess.kill();
        this.vlcProcess = null;
      }
      console.log("Starting VLC with full GUI for video:", videoPath);
      this.vlcProcess = child_process.spawn(
        vlcPath,
        [
          "--no-video-title-show",
          // Don't show title overlay
          "--video-on-top",
          // Keep video window on top initially
          videoPath
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          detached: false
        }
      );
      if (!this.vlcProcess) {
        throw new Error("Failed to start VLC process");
      }
      this.vlcProcess.on("error", (error) => {
        console.error("VLC process error:", error);
        this.emit("error", error);
      });
      this.vlcProcess.on("exit", (code, signal) => {
        console.log(`VLC process exited with code: ${code}, signal: ${signal}`);
        this.isReady = false;
        this.currentState.playing = false;
        this.currentState.paused = false;
        this.emit("exit", { code, signal });
      });
      this.currentState.filename = videoPath;
      this.currentState.playing = true;
      this.currentState.paused = false;
      this.isReady = true;
      this.emit("loaded", { filename: videoPath });
    } catch (error) {
      console.error("Failed to play video in VLC:", error);
      throw error;
    }
  }
  async loadVideo(videoPath) {
    try {
      const vlcPath = await this.ensureVLCInstalled();
      if (this.vlcProcess) {
        this.vlcProcess.kill();
        this.vlcProcess = null;
      }
      console.log("Starting VLC with video:", videoPath);
      this.vlcProcess = child_process.spawn(
        vlcPath,
        [
          "--intf",
          "http",
          // Enable HTTP interface
          "--extraintf",
          "macosx",
          // Also enable macOS interface for video display
          "--http-host",
          "127.0.0.1",
          // Bind to localhost
          "--http-port",
          this.httpPort.toString(),
          // HTTP port
          "--http-password",
          this.httpPassword,
          // Password for HTTP interface
          "--no-video-title-show",
          // Don't show title overlay
          "--sub-track",
          "0",
          // Start with subtitles disabled
          "--no-random",
          // Don't shuffle
          "--no-loop",
          // Don't loop
          "--no-repeat",
          // Don't repeat
          "--video-on-top",
          // Keep video window on top
          videoPath
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          detached: false
        }
      );
      if (!this.vlcProcess) {
        throw new Error("Failed to start VLC process");
      }
      this.vlcProcess.on("error", (error) => {
        console.error("VLC process error:", error);
        this.emit("error", error);
      });
      this.vlcProcess.on("exit", (code, signal) => {
        console.log(`VLC process exited with code: ${code}, signal: ${signal}`);
        this.isReady = false;
        this.currentState.playing = false;
        this.currentState.paused = false;
        this.emit("exit", { code, signal });
      });
      this.vlcProcess.stdout?.on("data", (data) => {
        console.log("VLC stdout:", data.toString());
      });
      this.vlcProcess.stderr?.on("data", (data) => {
        console.log("VLC stderr:", data.toString());
      });
      await this.waitForHTTPInterface();
      this.currentState.filename = videoPath;
      this.currentState.playing = false;
      this.currentState.paused = true;
      this.isReady = true;
      this.emit("loaded", { filename: videoPath });
    } catch (error) {
      console.error("Failed to load video in VLC:", error);
      throw error;
    }
  }
  async waitForHTTPInterface() {
    const maxAttempts = 30;
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.httpPort}/requests/status.xml`, {
          headers: {
            Authorization: "Basic " + Buffer.from(`:${this.httpPassword}`).toString("base64")
          }
        });
        if (response.ok) {
          console.log("VLC HTTP interface ready");
          return;
        }
      } catch (error) {
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("VLC HTTP interface failed to start");
  }
  async vlcCommand(command) {
    if (!this.isReady) {
      throw new Error("VLC not ready");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${this.httpPort}/requests/status.xml?command=${command}`, {
        headers: {
          Authorization: "Basic " + Buffer.from(`:${this.httpPassword}`).toString("base64")
        }
      });
      if (!response.ok) {
        throw new Error(`VLC command failed: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error("VLC command error:", error);
      throw error;
    }
  }
  async play() {
    try {
      await this.vlcCommand("pl_play");
      this.currentState.playing = true;
      this.currentState.paused = false;
      this.emit("play");
    } catch (error) {
      console.error("Failed to play:", error);
      throw error;
    }
  }
  async pause() {
    try {
      await this.vlcCommand("pl_pause");
      this.currentState.playing = false;
      this.currentState.paused = true;
      this.emit("pause");
    } catch (error) {
      console.error("Failed to pause:", error);
      throw error;
    }
  }
  async stop() {
    try {
      await this.vlcCommand("pl_stop");
      this.currentState.playing = false;
      this.currentState.paused = false;
      this.emit("stop");
    } catch (error) {
      console.error("Failed to stop:", error);
      throw error;
    }
  }
  async seek(seconds) {
    try {
      await this.vlcCommand(`seek&val=${seconds}`);
      this.currentState.currentTime = seconds;
      this.emit("seek", seconds);
    } catch (error) {
      console.error("Failed to seek:", error);
      throw error;
    }
  }
  async setVolume(volume) {
    try {
      const vol = Math.max(0, Math.min(100, volume));
      await this.vlcCommand(`volume&val=${vol / 100 * 256}`);
      this.currentState.volume = vol;
      this.emit("volumeChange", vol);
    } catch (error) {
      console.error("Failed to set volume:", error);
      throw error;
    }
  }
  // Subtitle controls that actually work!
  async enableSubtitles(trackId) {
    try {
      const track = trackId || 1;
      await this.vlcCommand(`spu_track&val=${track}`);
      this.emit("subtitles-enabled", track);
    } catch (error) {
      console.error("Failed to enable subtitles:", error);
      throw error;
    }
  }
  async disableSubtitles() {
    try {
      await this.vlcCommand("spu_track&val=-1");
      this.emit("subtitles-disabled");
    } catch (error) {
      console.error("Failed to disable subtitles:", error);
      throw error;
    }
  }
  async getSubtitleTracks() {
    try {
      const status = await this.vlcCommand("");
      return [];
    } catch (error) {
      console.error("Failed to get subtitle tracks:", error);
      return [];
    }
  }
  getState() {
    return { ...this.currentState };
  }
  async createStreamingPlayer(videoPath, port = 8081) {
    try {
      const vlcPath = await this.ensureVLCInstalled();
      if (this.vlcProcess) {
        this.vlcProcess.kill();
        this.vlcProcess = null;
      }
      console.log("Starting VLC with web interface on port 8080 for:", videoPath);
      this.vlcProcess = child_process.spawn(
        vlcPath,
        [
          "--intf",
          "http",
          // HTTP web interface
          "--http-host",
          "0.0.0.0",
          // Accept connections from anywhere
          "--http-port",
          "8080",
          // Web interface port
          "--http-password",
          "vlcpass",
          // Set password for web interface
          "--no-video-title-show",
          videoPath
        ],
        {
          stdio: ["pipe", "pipe", "pipe"]
        }
      );
      if (!this.vlcProcess) {
        throw new Error("Failed to start VLC streaming process");
      }
      this.vlcProcess.on("error", (error) => {
        console.error("VLC streaming error:", error);
        this.emit("error", error);
      });
      this.vlcProcess.on("exit", (code, signal) => {
        console.log(`VLC streaming process exited with code: ${code}, signal: ${signal}`);
        this.isReady = false;
        this.emit("exit", { code, signal });
      });
      this.vlcProcess.stdout?.on("data", (data) => {
        console.log("VLC streaming stdout:", data.toString());
      });
      this.vlcProcess.stderr?.on("data", (data) => {
        console.log("VLC streaming stderr:", data.toString());
      });
      this.currentState.filename = videoPath;
      this.currentState.playing = true;
      this.isReady = true;
      this.emit("streaming-started", { port, videoPath });
    } catch (error) {
      console.error("Failed to create VLC streaming player:", error);
      throw error;
    }
  }
  async cleanup() {
    if (this.vlcProcess) {
      this.vlcProcess.kill();
      this.vlcProcess = null;
    }
    this.isReady = false;
  }
}
let vlcService = null;
function setupVLCHandlers() {
  vlcService = new VLCService();
  setVLCServiceGetter(() => vlcService);
  vlcService.on("ready", () => {
    console.log("VLC service is ready");
  });
  vlcService.on("error", (error) => {
    console.error("VLC service error:", error);
  });
  vlcService.on("loaded", (data) => {
    console.log("VLC loaded video:", data);
  });
  vlcService.on("play", () => {
    console.log("VLC started playing");
  });
  vlcService.on("pause", () => {
    console.log("VLC paused");
  });
  vlcService.on("stop", () => {
    console.log("VLC stopped");
  });
  electron.ipcMain.handle("vlc:initialize", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.initialize();
      return { success: true };
    } catch (error) {
      console.error("Failed to initialize VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:load-video", async (event, videoPath) => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.loadVideo(videoPath);
      return { success: true };
    } catch (error) {
      console.error("Failed to load video in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:play-video-gui", async (event, videoPath) => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.playVideoWithGUI(videoPath);
      return { success: true };
    } catch (error) {
      console.error("Failed to play video with GUI in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:play", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.play();
      return { success: true };
    } catch (error) {
      console.error("Failed to play in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:pause", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.pause();
      return { success: true };
    } catch (error) {
      console.error("Failed to pause in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:stop", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.stop();
      return { success: true };
    } catch (error) {
      console.error("Failed to stop in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:seek", async (event, seconds) => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.seek(seconds);
      return { success: true };
    } catch (error) {
      console.error("Failed to seek in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:set-volume", async (event, volume) => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.setVolume(volume);
      return { success: true };
    } catch (error) {
      console.error("Failed to set volume in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:enable-subtitles", async (event, trackId) => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.enableSubtitles(trackId);
      return { success: true };
    } catch (error) {
      console.error("Failed to enable subtitles in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:disable-subtitles", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.disableSubtitles();
      return { success: true };
    } catch (error) {
      console.error("Failed to disable subtitles in VLC:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:get-subtitle-tracks", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      const tracks = await vlcService.getSubtitleTracks();
      return { success: true, tracks };
    } catch (error) {
      console.error("Failed to get subtitle tracks in VLC:", error);
      return { success: false, error: error.message, tracks: [] };
    }
  });
  electron.ipcMain.handle("vlc:get-state", async () => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      const state = vlcService.getState();
      return { success: true, state };
    } catch (error) {
      console.error("Failed to get VLC state:", error);
      return { success: false, error: error.message, state: null };
    }
  });
  electron.ipcMain.handle("vlc:create-stream", async (event, videoPath, port = 8081) => {
    try {
      if (!vlcService) {
        throw new Error("VLC service not available");
      }
      await vlcService.createStreamingPlayer(videoPath, port);
      return { success: true };
    } catch (error) {
      console.error("Failed to create VLC stream:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("vlc:cleanup", async () => {
    try {
      if (vlcService) {
        await vlcService.cleanup();
      }
      return { success: true };
    } catch (error) {
      console.error("Failed to cleanup VLC:", error);
      return { success: false, error: error.message };
    }
  });
}
async function cleanupVLC() {
  if (vlcService) {
    await vlcService.cleanup();
    vlcService = null;
  }
}
electron.app.commandLine.appendSwitch("enable-features", "PlatformHEVCDecoderSupport,VaapiVideoDecoder,MetalRenderer");
electron.app.commandLine.appendSwitch("use-angle", "metal");
electron.app.commandLine.appendSwitch("enable-accelerated-video-decode");
electron.app.commandLine.appendSwitch("enable-gpu-rasterization");
electron.app.commandLine.appendSwitch("enable-zero-copy");
electron.app.commandLine.appendSwitch("ignore-gpu-blacklist");
electron.app.commandLine.appendSwitch("enable-unsafe-webgpu");
electron.app.commandLine.appendSwitch("disable-web-security");
electron.app.commandLine.appendSwitch("disable-features", "VizDisplayCompositor");
electron.app.commandLine.appendSwitch("allow-running-insecure-content");
electron.app.commandLine.appendSwitch("disable-site-isolation-trials");
electron.app.commandLine.appendSwitch("ignore-certificate-errors");
electron.app.whenReady().then(async () => {
  utils.electronApp.setAppUserModelId("com.electron");
  setupVLCHandlers();
  await createAppWindow();
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.app.on("activate", async function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      await createAppWindow();
    }
  });
});
electron.app.on("window-all-closed", async () => {
  await cleanupVLC();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", async () => {
  await cleanupVLC();
});
