interface ReleaseTrackerBridge {
  getApiBaseUrl?(): Promise<string>;
  getApiToken?(): Promise<string>;
  getDiagnosticsLogPath?(): Promise<string>;
  openDiagnosticsLog?(): Promise<{ ok?: boolean; error?: string }>;
  chooseWallpaper?(): Promise<string | null>;
  // Saves PNG bytes the page drew (the Year in Review poster) through a save dialog. Desktop only.
  saveImage?(png: Uint8Array, suggestedName: string): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
}

interface Window {
  releaseTracker?: ReleaseTrackerBridge;
}
