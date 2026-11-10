import type { CapacitorConfig } from "@capacitor/cli";

// The Android app: the web bundle from apps/mobile (npm run build:mobile) in a Capacitor WebView.
const config: CapacitorConfig = {
  appId: "io.github.hachi23.gamereleasetracker",
  appName: "Game Release Tracker",
  webDir: "dist/mobile",
  android: {
    path: "apps/mobile/android"
  },
  plugins: {
    // IGDB and Twitch don't allow browser (CORS) requests; this sends the backend's fetch calls
    // through Android's native HTTP stack instead.
    CapacitorHttp: { enabled: true },
    LocalNotifications: { iconColor: "#D3B26A" }
  }
};

export default config;
