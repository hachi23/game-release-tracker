import "@fontsource-variable/fraunces";
import "@fontsource-variable/work-sans";
import "@fontsource/caveat/700.css";
import "./academy/theme.css";
import "./academy/term";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { installImageFallback } from "../../frontend/src/ui/imageFallback";
import { AcademyApp } from "./academy/AcademyApp";
import { bootMobileApp } from "./boot";

// The Android app: the in-app backend (boot.ts) under the Magic Academy UI.
async function main() {
  installImageFallback(document);
  const app = await bootMobileApp();
  let handleBack: () => boolean = () => false;
  if (Capacitor.isNativePlatform()) {
    void NativeApp.addListener("backButton", () => {
      if (!handleBack()) void NativeApp.minimizeApp();
    });
  }
  createRoot(document.getElementById("root")!).render(
    <AcademyApp
      api={app.api}
      library={app.library}
      registerOpenRelease={open => { app.onOpenRelease = open; }}
      onBackButton={handler => { handleBack = handler; }}
    />
  );
}

void main().catch(error => {
  document.getElementById("root")!.textContent = `The app couldn't open its library: ${error instanceof Error ? error.message : String(error)}`;
});
