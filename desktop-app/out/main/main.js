"use strict";
const electron = require("electron");
const utils = require("@electron-toolkit/utils");
const path = require("path");
const url = require("url");
const zod = require("zod");
const preload = require("@electron-toolkit/preload");
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
    const fullscreenWindow = new electron.BrowserWindow({
      fullscreen: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    fullscreenWindow.loadURL(url2);
    fullscreenWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape") {
        fullscreenWindow.close();
      }
    });
    return fullscreenWindow.id;
  });
};
const registerAppHandlers = (app) => {
  handle("version", () => app.getVersion());
};
function createAppWindow() {
  registerResourcesProtocol();
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    backgroundColor: "#1c1c1c",
    icon: appIcon,
    frame: false,
    titleBarStyle: "hiddenInset",
    title: "Electron React App",
    maximizable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: false
    }
  });
  registerWindowHandlers(mainWindow);
  registerAppHandlers(electron.app);
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  createAppWindow();
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createAppWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
