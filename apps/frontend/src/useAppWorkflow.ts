import { useMemo } from "react";
import { createApiClient, type ApiClient } from "./api/client";
import { useAppShell, type AppState } from "./appShell";
import { useReleaseWorkspace } from "./releaseWorkspace";
import { useCompletedLibraryWorkflow } from "./useCompletedLibraryWorkflow";
import { useRandomizerWorkflow } from "./useRandomizerWorkflow";
import { useSettingsWorkflow } from "./useSettingsWorkflow";
import { usePalette } from "./theme/usePalette";
import { useWallpaperWorkflow } from "./wallpaperWorkflow";
import { useYearInReviewWorkflow } from "./useYearInReviewWorkflow";

export type { AppState };

// `api` replaces the HTTP client, e.g. with an in-memory fake in tests.
export function useAppWorkflow({ apiBaseUrl, initialState, api: injectedApi }: { apiBaseUrl: string; initialState?: AppState; api?: ApiClient }) {
  const api = useMemo(() => injectedApi ?? createApiClient(apiBaseUrl), [apiBaseUrl, injectedApi]);
  const shell = useAppShell({ api, initialView: initialState?.initialView, initialOperationError: initialState?.operationError });
  const releaseWorkspace = useReleaseWorkspace({ api, initialState, shell });
  const completedLibrary = useCompletedLibraryWorkflow({ api, shell, initialState });
  const randomizer = useRandomizerWorkflow({ api, shell, active: shell.view === "randomizer" });
  const yearInReview = useYearInReviewWorkflow({ api, shell, active: shell.view === "year-in-review" });
  const palette = usePalette(api);
  const wallpaper = useWallpaperWorkflow({ api, apiBaseUrl, onError: shell.reportOperationError });
  const settings = useSettingsWorkflow({
    api,
    initialStatus: initialState?.settingsStatus,
    loadOnOpen: !initialState && shell.view === "settings",
    onError: shell.reportOperationError
  });

  return {
    ...releaseWorkspace,
    view: shell.view,
    operationError: shell.operationError,
    completedLibrary,
    randomizer,
    yearInReview,
    palette,
    hasNativeWallpaperPicker: wallpaper.hasNativeWallpaperPicker,
    wallpaperUrl: wallpaper.wallpaperUrl,
    settings,
    actions: {
      ...releaseWorkspace.actions,
      chooseWallpaper: wallpaper.actions.chooseWallpaper,
      clearWallpaper: wallpaper.actions.clearWallpaper
    }
  };
}
