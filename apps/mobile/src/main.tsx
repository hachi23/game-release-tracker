import "../../frontend/src/fonts.css";
import { createRoot } from "react-dom/client";
import { AppShell } from "../../frontend/src/App";
import { ErrorBoundary } from "../../frontend/src/ErrorBoundary";
import { installImageFallback } from "../../frontend/src/ui/imageFallback";
import { createMobileApiClient, prepareMobileDatabase } from "./mobileApiClient";
import { asTrackerDatabase, openWasmDatabase } from "./wasmDatabase";

// The Android entry: the desktop renderer, with the backend running in the page instead of a child process.
async function main() {
  installImageFallback(document);
  const db = asTrackerDatabase(await openWasmDatabase("local"));
  prepareMobileDatabase(db);
  const api = createMobileApiClient(db);
  // The preview has no IGDB sync yet, so a new install starts with the sample library.
  if (!(await api.getDemo()).loaded && (await api.listReleases()).items.length === 0) await api.loadDemo();
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary api={api}>
      <AppShell apiBaseUrl="" api={api} />
    </ErrorBoundary>
  );
}

void main();
