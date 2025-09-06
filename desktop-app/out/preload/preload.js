"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
class ConveyorApi {
  renderer;
  constructor(electronApi) {
    this.renderer = electronApi.ipcRenderer;
  }
  invoke = async (channel, ...args) => {
    return this.renderer.invoke(channel, ...args);
  };
}
class AppApi extends ConveyorApi {
  version = () => this.invoke("version");
}
class WindowApi extends ConveyorApi {
  // Generate window methods
  windowInit = () => this.invoke("window-init");
  windowIsMinimizable = () => this.invoke("window-is-minimizable");
  windowIsMaximizable = () => this.invoke("window-is-maximizable");
  windowMinimize = () => this.invoke("window-minimize");
  windowMaximize = () => this.invoke("window-maximize");
  windowClose = () => this.invoke("window-close");
  windowMaximizeToggle = () => this.invoke("window-maximize-toggle");
  // Generate web methods
  webUndo = () => this.invoke("web-undo");
  webRedo = () => this.invoke("web-redo");
  webCut = () => this.invoke("web-cut");
  webCopy = () => this.invoke("web-copy");
  webPaste = () => this.invoke("web-paste");
  webDelete = () => this.invoke("web-delete");
  webSelectAll = () => this.invoke("web-select-all");
  webReload = () => this.invoke("web-reload");
  webForceReload = () => this.invoke("web-force-reload");
  webToggleDevtools = () => this.invoke("web-toggle-devtools");
  webActualSize = () => this.invoke("web-actual-size");
  webZoomIn = () => this.invoke("web-zoom-in");
  webZoomOut = () => this.invoke("web-zoom-out");
  webToggleFullscreen = () => this.invoke("web-toggle-fullscreen");
  webOpenUrl = (url) => this.invoke("web-open-url", url);
  webOpenFullscreenBrowser = (url) => this.invoke("web-open-fullscreen-browser", url);
  webCloseBrowserView = () => this.invoke("web-close-browser-view");
}
const conveyor = {
  app: new AppApi(preload.electronAPI),
  window: new WindowApi(preload.electronAPI)
};
const websiteApi = {
  /**
   * Check if running in Electron
   */
  async isElectron() {
    try {
      return await electron.ipcRenderer.invoke("website:is-electron");
    } catch (error) {
      return { success: false, error: "Not in Electron environment" };
    }
  },
  /**
   * Get app information
   */
  async getAppInfo() {
    return await electron.ipcRenderer.invoke("website:get-app-info");
  },
  /**
   * Request video playback in Electron app
   */
  async playVideo(videoUrl, videoInfo) {
    return await electron.ipcRenderer.invoke("website:play-video", videoUrl, videoInfo);
  },
  /**
   * Focus the Electron window
   */
  async focusWindow() {
    return await electron.ipcRenderer.invoke("website:focus-window");
  },
  /**
   * Listen for video playback requests from website
   */
  onPlayVideoRequest(callback) {
    const handler = (_event, request) => {
      callback(request);
    };
    electron.ipcRenderer.on("website:play-video-request", handler);
    return () => {
      electron.ipcRenderer.removeListener("website:play-video-request", handler);
    };
  },
  /**
   * Simple detection method for websites
   */
  detectElectron() {
    return typeof window !== "undefined" && typeof window.process === "object" && window.process.type === "renderer";
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("conveyor", conveyor);
    electron.contextBridge.exposeInMainWorld("websiteApi", websiteApi);
    electron.contextBridge.exposeInMainWorld("isElectron", true);
  } catch (error) {
    console.error(error);
  }
} else {
  window.conveyor = conveyor;
  window.websiteApi = websiteApi;
  window.isElectron = true;
}
