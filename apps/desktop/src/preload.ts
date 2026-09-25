import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("releaseTracker", {
  getApiBaseUrl: () => ipcRenderer.invoke("api-base-url"),
  getApiToken: () => ipcRenderer.invoke("api-token"),
  getDiagnosticsLogPath: () => ipcRenderer.invoke("diagnostics-log-path"),
  openDiagnosticsLog: () => ipcRenderer.invoke("open-diagnostics-log"),
  chooseWallpaper: () => ipcRenderer.invoke("choose-wallpaper"),
  saveImage: (png: Uint8Array, suggestedName: string) => ipcRenderer.invoke("save-image", png, suggestedName),
  openLogFolder: () => ipcRenderer.invoke("open-log-folder"),
  deleteAppData: () => ipcRenderer.invoke("delete-app-data")
});
