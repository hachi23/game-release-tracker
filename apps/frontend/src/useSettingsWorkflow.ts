import { useState } from "react";
import type { SettingsStatus } from "../../../shared/types";
import type { ApiClient } from "./api/client";
import { useLoadOnFirstOpen } from "./useLoadOnFirstOpen";

// The unsaved IGDB credential drafts typed on the Settings page.
interface IgdbSettingsForm {
  IGDB_CLIENT_ID: string;
  IGDB_CLIENT_SECRET: string;
  IGDB_ACCESS_TOKEN: string;
}

const emptySettings: IgdbSettingsForm = {
  IGDB_CLIENT_ID: "",
  IGDB_CLIENT_SECRET: "",
  IGDB_ACCESS_TOKEN: ""
};

// The Settings page: saved credential status (loaded on first open), the credential drafts, save/clear/test.
export function useSettingsWorkflow({
  api,
  initialStatus,
  loadOnOpen,
  onError
}: {
  api: ApiClient;
  initialStatus?: SettingsStatus;
  loadOnOpen: boolean;
  onError?: (action: string, error: unknown) => void;
}) {
  const [settings, setSettings] = useState<IgdbSettingsForm>(emptySettings);
  const [steamGridDbKey, setSteamGridDbKey] = useState("");
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus | undefined>(initialStatus);

  useLoadOnFirstOpen(loadOnOpen, () => {
    api.getSettings().then(setSettingsStatus, error => onError?.("load-settings", error));
  });

  const resetDrafts = () => {
    setSettings(emptySettings);
    setSteamGridDbKey("");
  };

  const saveSettings = async () => {
    try {
      const result = await api.patchSettings({ ...settings, STEAMGRIDDB_API_KEY: steamGridDbKey });
      setSettingsStatus(result.settings);
      resetDrafts();
    } catch (error) {
      onError?.("save-settings", error);
    }
  };

  const clearCredentials = async () => {
    try {
      const result = await api.clearCredentials();
      setSettingsStatus(result.settings);
      resetDrafts();
    } catch (error) {
      onError?.("clear-credentials", error);
    }
  };

  const testCredentials = async () => {
    try {
      const { credentialStatus } = await api.testCredentials();
      setSettingsStatus(current => ({ autoSyncDue: false, credentials: emptyCredentialFlags(), ...current, credentialStatus }));
    } catch (error) {
      onError?.("test-credentials", error);
    }
  };

  return {
    settings,
    settingsStatus,
    steamGridDbKey,
    actions: {
      setSettings,
      setSteamGridDbKey,
      saveSettings,
      clearCredentials,
      testCredentials
    }
  };
}

export type SettingsWorkflow = ReturnType<typeof useSettingsWorkflow>;

function emptyCredentialFlags(): SettingsStatus["credentials"] {
  return {
    IGDB_CLIENT_ID: { saved: false },
    IGDB_CLIENT_SECRET: { saved: false },
    IGDB_ACCESS_TOKEN: { saved: false },
    STEAMGRIDDB_API_KEY: { saved: false }
  };
}
