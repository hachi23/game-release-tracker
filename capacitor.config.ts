import type { CapacitorConfig } from "@capacitor/cli";

// The Android preview: the web bundle from apps/mobile (npm run build:mobile) in a Capacitor WebView.
const config: CapacitorConfig = {
  appId: "io.github.hachi23.gamereleasetracker",
  appName: "Game Release Tracker",
  webDir: "dist/mobile",
  android: {
    path: "apps/mobile/android"
  }
};

export default config;
