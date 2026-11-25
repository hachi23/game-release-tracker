import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, protocol, safeStorage, session, shell, Tray } from "electron";
import { APP_ORIGIN, handleInProcessAppProtocol, identifyAppToYouTube, registerAppScheme } from "./appProtocol";
import { startInProcessBackend, type InProcessBackend } from "./inProcessBackend";
import { handleStartupFailure, logBackendStoppedBeforeQuit, logDesktopFatalStartup, logDesktopProcessFailure, prepareDesktopRuntime } from "./desktopLifecycle";
import { registerWallpaperIpc } from "./wallpaperIpc";
import { registerSaveImageIpc } from "./saveImageIpc";
import { registerAppDataIpc } from "./appDataIpc";
import { decideNavigation, installWindowGuards } from "./windowGuards";
import { loadCredentialDataKey } from "./credentialKey";
import { type AppTray, bringWindowBack, setupAppTray } from "./trayWindow";
import { createSystemNotifier, startReleaseAlerts } from "./releaseAlerts";
import { createStartAtLogin, registerStartAtLoginIpc, startsHidden } from "./startAtLogin";
import { createFileDiagnosticLogger } from "../../backend/src/diagnostics/logger";
import type { resolveDesktopRuntimeLayout } from "../../runtime/src/layout";

// Low-memory defaults for 2 GB RAM systems (works identically on Windows and Linux):
// disabling GPU hardware acceleration drops ~110 MB of Chromium GPU compositor memory,
// --in-process-gpu avoids a separate GPU OS process, and heap/cache caps stop idle bloat.
if (process.env.GRT_ENABLE_GPU !== "1") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("in-process-gpu");
}
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=96");
app.commandLine.appendSwitch("disk-cache-size", String(16 * 1024 * 1024));
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion,MediaRouter,OptimizationHints,Translate");

let mainWindow: BrowserWindow | null = null;
let openingWindow: Promise<BrowserWindow> | null = null;
// True only when the window was intentionally destroyed to minimize/start into the system tray.
let hiddenInTray = false;
// Held for the app's lifetime: a tray icon that is garbage-collected disappears.
let tray: AppTray | null = null;
let backend: InProcessBackend | null = null;
let runtimeLayout: ReturnType<typeof resolveDesktopRuntimeLayout> | null = null;
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

// The data folder is named after the app (on Windows %APPDATA%\Game Release Tracker), not after the npm
// package, so the app never shares a folder with another build of the same package. Set before anything
// reads userData. An explicit --user-data-dir (a test profile) still wins.
// Windows shows notifications under this id (the installer's shortcut carries the same one).
if (process.platform === "win32") app.setAppUserModelId("io.github.hachi23.game-release-tracker");
if (!app.commandLine.hasSwitch("user-data-dir")) app.setPath("userData", join(app.getPath("appData"), "Game Release Tracker"));
registerAppScheme(protocol);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// Starting the app again brings the running window back, even from the tray (recreating it if destroyed).
app.on("second-instance", () => void openMainWindow());

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
      await running?.stop();
    },
    clearBrowserStorage: () => session.defaultSession.clearStorageData(),
    relaunch: () => {
      app.relaunch();
      app.exit(0);
    }
  }
});
registerStartAtLoginIpc({
  ipcMain,
  isAppFrame,
  startAtLogin: createStartAtLogin({
    platform: process.platform,
    packaged: app.isPackaged,
    launchPath: process.env.APPIMAGE || process.execPath,
    autostartDir: join(app.getPath("appData"), "autostart"),
    getLoginItemSettings: options => app.getLoginItemSettings(options),
    setLoginItemSettings: settings => app.setLoginItemSettings(settings)
  })
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

async function openMainWindow(releaseId?: string): Promise<BrowserWindow> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    hiddenInTray = false;
    bringWindowBack(mainWindow);
    if (releaseId) mainWindow.webContents.send("open-release", releaseId);
    return mainWindow;
  }
  if (openingWindow) {
    const win = await openingWindow;
    if (releaseId && !win.isDestroyed()) win.webContents.send("open-release", releaseId);
    return win;
  }
  if (!runtimeLayout) throw new Error("Desktop runtime is not initialized yet");
  const layout = runtimeLayout;
  hiddenInTray = false;

  const promise = (async () => {
    const win = new BrowserWindow({
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
        spellcheck: false,
        backgroundThrottling: true,
        // Year in Review's theme music may start without a click once the user turns autoplay on in Settings;
        // until then it waits for one.
        autoplayPolicy: "no-user-gesture-required",
        devTools: !app.isPackaged
      }
    });
    mainWindow = win;
    // Links open in the browser; the app window only ever shows the app.
    installWindowGuards(win.webContents, {
      appOrigin: rendererOrigin,
      openExternal: url => shell.openExternal(url)
    });
    // Minimizing to the tray destroys the BrowserWindow so the renderer process & decoded images
    // free their RAM immediately; clicking the tray icon recreates the window on demand.
    win.on("minimize", () => {
      if (!tray || win.isDestroyed()) return;
      hiddenInTray = true;
      if (mainWindow === win) mainWindow = null;
      win.destroy();
    });
    win.on("closed", () => {
      if (mainWindow === win) mainWindow = null;
    });

    await win.loadURL(app.isPackaged ? `${APP_ORIGIN}/` : layout.frontendDevUrl);
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
      if (releaseId) win.webContents.send("open-release", releaseId);
    }
    return win;
  })();

  openingWindow = promise;
  try {
    return await promise;
  } finally {
    if (openingWindow === promise) openingWindow = null;
  }
}

async function startDesktopApp() {
  const { root, layout, logPath: startupLogPath } = prepareDesktopRuntime(app);
  runtimeLayout = layout;
  logPath = startupLogPath;
  diagnosticsLogPath = layout.diagnosticLogPath;
  dataDir = layout.backendDataDir;
  frontendDevUrl = layout.frontendDevUrl;

  const diagnostics = createFileDiagnosticLogger(layout.logDir);
  const credentialKey = loadCredentialDataKey({ dir: layout.backendDataDir, safeStorage, log: (event, details) => diagnostics.log(event, details) });
  backend = await startInProcessBackend({
    layout,
    apiToken,
    credentialKey,
    packaged: app.isPackaged
  });
  apiBaseUrl = backend.apiBaseUrl;

  if (app.isPackaged) {
    const runningBackend = backend;
    handleInProcessAppProtocol(protocol, request => runningBackend.handleAppRequest(request));
    identifyAppToYouTube(session.defaultSession);
  }

  tray = setupAppTray({
    createTray: () => createAppTray(root),
    onOpen: () => void openMainWindow(),
    quit: () => {
      hiddenInTray = false;
      app.quit();
    },
    log: message => diagnostics.log("desktop.tray_unavailable", { message })
  });

  // Started at login with --hidden: stay resident in the tray without creating a BrowserWindow
  // (keeps idle background RAM down to the main process + SQLite only).
  if (startsHidden(process.argv) && tray) {
    hiddenInTray = true;
  } else {
    await openMainWindow();
  }

  startReleaseAlerts({
    takeAlerts: () => (backend ? backend.takeAlerts() : Promise.resolve([])),
    notifier: createSystemNotifier({
      isSupported: () => Notification.isSupported(),
      create: alert => new Notification({ title: alert.title, body: alert.body, icon: appIconImage(root) }),
      fallback: (alert, onClick) => tray?.showBalloon?.(alert.title, alert.body, onClick)
    }),
    openRelease: releaseId => void openMainWindow(releaseId),
    log: message => diagnostics.log("desktop.release_alerts", { message })
  });
}

// The app icon for the tray and notifications: the multi-size .ico on Windows, the PNG scaled down elsewhere.
function appIconImage(root: string) {
  return process.platform === "win32"
    ? nativeImage.createFromPath(join(root, "build", "icon.ico"))
    : nativeImage.createFromPath(join(root, "build", "icon.png")).resize({ width: 32, height: 32, quality: "best" });
}

function createAppTray(root: string): AppTray {
  const image = appIconImage(root);
  if (image.isEmpty()) throw new Error("tray icon image is missing");
  const electronTray = new Tray(image);
  return {
    setToolTip: text => electronTray.setToolTip(text),
    setContextMenu: items => electronTray.setContextMenu(Menu.buildFromTemplate(items)),
    on: (event, listener) => (event === "click" ? electronTray.on("click", listener) : electronTray.on("double-click", listener)),
    showBalloon: process.platform === "win32"
      ? (title, body, onClick) => {
          electronTray.removeAllListeners("balloon-click");
          electronTray.once("balloon-click", onClick);
          electronTray.displayBalloon({ title, content: body, icon: image });
        }
      : undefined,
    destroy: () => electronTray.destroy()
  };
}

app.whenReady().then(() => {
  // Camera, microphone, notifications, location and the rest are refused; trailers may go fullscreen.
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === "fullscreen"));
}).then(() => void startDesktopApp().catch(error => handleStartupFailure(error, {
  logFatal: startupError => logDesktopFatalStartup(app, startupError),
  showError: message => dialog.showErrorBox("Game Release Tracker startup failed", message),
  stopBackend: async () => {
    backendShutdownStarted = true;
    const running = backend;
    backend = null;
    await running?.stop();
  },
  quit: () => app.quit()
})));

app.on("before-quit", event => {
  hiddenInTray = false;
  if (!backend || backendShutdownStarted) return;
  event.preventDefault();
  backendShutdownStarted = true;
  const running = backend;
  backend = null;
  void running.stop().finally(() => {
    logBackendStoppedBeforeQuit(app, logPath);
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (hiddenInTray) return;
  if (process.platform !== "darwin") app.quit();
});
