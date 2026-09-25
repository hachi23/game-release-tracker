import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, session, shell } from "electron";
import { APP_ORIGIN, handleAppProtocol, identifyAppToYouTube, registerAppScheme } from "./appProtocol";
import { type BackendChild, startBackendProcess, stopBackendProcess } from "./backendProcess";
import { handleStartupFailure, logBackendStoppedBeforeQuit, logDesktopFatalStartup, logDesktopProcessFailure, prepareDesktopRuntime } from "./desktopLifecycle";
import { registerWallpaperIpc } from "./wallpaperIpc";
import { registerSaveImageIpc } from "./saveImageIpc";
import { registerAppDataIpc } from "./appDataIpc";
import { decideNavigation, installWindowGuards } from "./windowGuards";
import { loadCredentialDataKey } from "./credentialKey";
import { createFileDiagnosticLogger } from "../../backend/src/diagnostics/logger";

let mainWindow: BrowserWindow | null = null;
let backend: BackendChild | null = null;
let apiBaseUrl = "";
let logPath = "";
let diagnosticsLogPath = "";
let dataDir = "";
let frontendDevUrl = "";
let backendShutdownStarted = false;
let fatalDialogShown = false;
// A fresh secret each launch: the backend refuses /api calls without it, so web pages and other local
// programs cannot use the local API. Only this app's renderer receives it, through the preload.
const apiToken = randomBytes(32).toString("hex");

registerAppScheme(protocol);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// The packaged renderer reaches the backend through its own app:// origin; the development renderer
// (the Vite server) calls the backend directly.
const rendererOrigin = () => (app.isPackaged ? APP_ORIGIN : frontendDevUrl);
ipcMain.handle("api-base-url", () => (app.isPackaged ? APP_ORIGIN : apiBaseUrl));
// A frame showing the app itself, the only kind that gets the token or can save an image.
const isAppFrame = (url: string) => decideNavigation(url, rendererOrigin()) === "allow";
ipcMain.handle("api-token", event => (isAppFrame(event.senderFrame?.url ?? "") ? apiToken : null));
registerSaveImageIpc({
  ipcMain,
  dialog: { showSaveDialog: options => (mainWindow ? dialog.showSaveDialog(mainWindow, options) : dialog.showSaveDialog(options)) },
  getDefaultDir: () => app.getPath("pictures"),
  isAppFrame
});
ipcMain.handle("diagnostics-log-path", () => diagnosticsLogPath);
ipcMain.handle("open-diagnostics-log", async () => {
  if (!diagnosticsLogPath) return { ok: false, error: "Diagnostics log path is not available yet" };
  const error = await shell.openPath(diagnosticsLogPath);
  return { ok: !error, path: diagnosticsLogPath, error: error || undefined };
});
registerAppDataIpc({
  ipcMain,
  isAppFrame,
  getDataDir: () => dataDir,
  openLogFolder: () => (diagnosticsLogPath ? shell.openPath(dirname(diagnosticsLogPath)) : Promise.resolve("The log folder is not available yet")),
  steps: {
    confirm: async () => {
      const options = {
        type: "warning" as const,
        buttons: ["Delete everything", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: "Delete all app data?",
        detail: "This removes your library, covers, wallpaper, saved API keys, backups and logs from this computer, then restarts the app. It can't be undone."
      };
      const { response } = mainWindow ? await dialog.showMessageBox(mainWindow, options) : await dialog.showMessageBox(options);
      return response === 0;
    },
    stopBackend: async () => {
      backendShutdownStarted = true;
      const running = backend;
      backend = null;
      await stopBackendProcess(running, 3000);
    },
    clearBrowserStorage: () => session.defaultSession.clearStorageData(),
    relaunch: () => {
      app.relaunch();
      app.exit(0);
    }
  }
});
registerWallpaperIpc({
  ipcMain,
  dialog,
  getWindow: () => mainWindow,
  getDataDir: () => dataDir
});

function handleDesktopProcessFailure(event: string, error: unknown) {
  const message = logDesktopProcessFailure(app, event, error);
  console.error(`[${event}] ${message}`);
  if (!fatalDialogShown) {
    fatalDialogShown = true;
    dialog.showErrorBox("Game Release Tracker stopped unexpectedly", message);
  }
  app.quit();
}

process.on("uncaughtException", error => handleDesktopProcessFailure("process.uncaught_exception", error));
process.on("unhandledRejection", reason => handleDesktopProcessFailure("process.unhandled_rejection", reason));

async function createWindow() {
  const { root, layout, logPath: startupLogPath } = prepareDesktopRuntime(app);
  logPath = startupLogPath;
  diagnosticsLogPath = layout.diagnosticLogPath;
  dataDir = layout.backendDataDir;
  frontendDevUrl = layout.frontendDevUrl;
  // Start the backend first, then build the hidden window while it boots so the renderer
  // process spin-up overlaps backend startup instead of waiting behind it.
  const diagnostics = createFileDiagnosticLogger(layout.logDir);
  const credentialKey = loadCredentialDataKey({ dir: layout.backendDataDir, safeStorage, log: (event, details) => diagnostics.log(event, details) });
  const backendStarting = startBackendProcess(root, { logPath, dataDir: layout.backendDataDir, apiToken, credentialKey, packaged: app.isPackaged });
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    show: false,
    webPreferences: {
      preload: layout.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Year in Review's theme music starts by itself when a year with a theme link opens.
      autoplayPolicy: "no-user-gesture-required",
      devTools: !app.isPackaged
    }
  });
  // Links open in the browser; the app window only ever shows the app.
  installWindowGuards(mainWindow.webContents, {
    appOrigin: rendererOrigin,
    openExternal: url => shell.openExternal(url)
  });
  const backendReady = await backendStarting;
  backend = backendReady.child;
  const runningBackend = backend;
  runningBackend.once?.("exit", code => {
    if (backend !== runningBackend || backendShutdownStarted) return;
    backend = null;
    handleDesktopProcessFailure("backend.child_exit", new Error(`Backend exited unexpectedly${code === undefined ? "" : ` with code ${String(code)}`}`));
  });
  runningBackend.once?.("error", error => {
    if (backend !== runningBackend || backendShutdownStarted) return;
    backend = null;
    handleDesktopProcessFailure("backend.child_error", error);
  });
  const port = backendReady.port;
  apiBaseUrl = `http://127.0.0.1:${port}`;
  if (app.isPackaged) {
    handleAppProtocol(protocol, net, () => apiBaseUrl);
    identifyAppToYouTube(session.defaultSession);
    await mainWindow.loadURL(`${APP_ORIGIN}/`);
  } else {
    await mainWindow.loadURL(layout.frontendDevUrl);
  }
  mainWindow.show();
}

app.whenReady().then(() => {
  // Camera, microphone, notifications, location and the rest are refused; trailers may go fullscreen.
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === "fullscreen"));
}).then(() => void createWindow().catch(error => handleStartupFailure(error, {
  logFatal: startupError => logDesktopFatalStartup(app, startupError),
  showError: message => dialog.showErrorBox("Game Release Tracker startup failed", message),
  stopBackend: async () => {
    backendShutdownStarted = true;
    const running = backend;
    backend = null;
    await stopBackendProcess(running, 3000);
  },
  quit: () => app.quit()
})));

app.on("before-quit", event => {
  if (!backend || backend.killed || backendShutdownStarted) return;
  event.preventDefault();
  backendShutdownStarted = true;
  void stopBackendProcess(backend, 3000).finally(() => {
    logBackendStoppedBeforeQuit(app, logPath);
    backend = null;
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
