import { useState } from "react";
import { PALETTES, type Palette } from "../theme/palettes";
import { FramedPanel } from "../ui/FramedPanel";
import { WallpaperPanel } from "./WallpaperPanel";
import type { SavedCredential, SettingsStatus } from "../../../../shared/types";
import type { SettingsWorkflow } from "../useSettingsWorkflow";
import type { SyncSettingsWorkflow } from "../useSyncSettingsWorkflow";
import { SyncSettingsPanel } from "./settings/SyncSettingsPanel";

const TABS = ["Appearance", "API keys", "Sync", "Diagnostics"] as const;
type SettingsTab = (typeof TABS)[number];

export function SettingsView({
  palette,
  setPaletteId,
  themeAutoplay,
  setThemeAutoplay,
  hasNativeWallpaperPicker,
  hasWallpaper,
  onChooseWallpaper,
  onClearWallpaper,
  workflow,
  syncWorkflow,
  onBack,
  diagnosticsLogPath,
  onOpenDiagnosticsLog
}: {
  palette: Palette;
  setPaletteId: (id: string) => void;
  themeAutoplay: boolean;
  setThemeAutoplay: (on: boolean) => void;
  hasNativeWallpaperPicker: boolean;
  hasWallpaper: boolean;
  onChooseWallpaper: (file?: File | null) => void | Promise<unknown>;
  onClearWallpaper: () => void | Promise<unknown>;
  workflow: SettingsWorkflow;
  syncWorkflow: SyncSettingsWorkflow;
  onBack: () => void;
  diagnosticsLogPath?: string;
  onOpenDiagnosticsLog?: () => void | Promise<unknown>;
}) {
  const { settings, settingsStatus, steamGridDbKey, actions } = workflow;
  // Opens on API keys while the IGDB keys need attention, since nothing else works without them.
  const [tab, setTab] = useState<SettingsTab>(() => (keysNeedAttention(settingsStatus) ? "API keys" : "Appearance"));
  return (
    <FramedPanel className="settings-view">
      <div className="settings-view__scroll">
      <button type="button" className="secondary inline" onClick={onBack}>← Back</button>
      <h1>Settings</h1>
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map(name => <button type="button" role="tab" className="secondary inline" aria-selected={tab === name} key={name} onClick={() => setTab(name)}>{name}</button>)}
      </div>
      {tab === "Appearance" && <>
      <section className="settings-section">
        <h3>Appearance</h3>
        {(["standard", "darker"] as const).map(group => <div key={group}>
          <p className="settings-subheading">{group === "standard" ? "Standard" : "Darker"}</p>
          <div className="palette-list">{PALETTES.filter(p => p.group === group).map(p => <button type="button" className="palette-swatch" aria-pressed={palette.id === p.id} key={p.id} onClick={() => setPaletteId(p.id)}>
            <span className="palette-swatch__dots">{[p.bg, p.panel, p.border, p.accent].map((colour, i) => <span className="palette-swatch__dot" style={{ backgroundColor: colour }} key={i} />)}</span><span>{p.name}</span>
          </button>)}</div>
        </div>)}
      </section>
      <section className="settings-section"><h3>Wallpaper</h3><WallpaperPanel hasNativePicker={hasNativeWallpaperPicker} hasWallpaper={hasWallpaper} onChooseWallpaper={onChooseWallpaper} onClearWallpaper={onClearWallpaper} /><p>Used as the background on Completed Library, Settings and list screens, and on Upcoming when a game has no artwork.</p></section>
      <section className="settings-section"><h3>Year in Review</h3>
        <label className="sync-auto"><input type="checkbox" className="check" checked={themeAutoplay} onChange={event => setThemeAutoplay(event.target.checked)} /> Play a year's theme music automatically when Year in Review opens (it loads YouTube)</label>
      </section>
      </>}
      {tab === "API keys" && <section className="settings-section">
        <h3>API keys</h3>
        <p className="journal-section-subtitle">Sync, search and the Randomizer use your own free IGDB keys (a Twitch developer app). The SteamGridDB key is optional and fills in missing artwork. Keys are stored encrypted on this computer and never shown again.</p>
        <div className={`settings-status ${settingsStatus?.credentialStatus.status ?? "missing"}`}>
          Credential status: {settingsStatus?.credentialStatus.status ?? "missing"}
          {settingsStatus?.credentialStatus.message ? ` - ${settingsStatus.credentialStatus.message}` : ""}
        </div>
        <div className="saved-credentials">
          <span>{credentialLabel("Client ID", settingsStatus?.credentials.IGDB_CLIENT_ID)}</span>
          <span>{credentialLabel("Client secret", settingsStatus?.credentials.IGDB_CLIENT_SECRET)}</span>
          <span>{credentialLabel("Access token", settingsStatus?.credentials.IGDB_ACCESS_TOKEN)}</span>
          <span>{credentialLabel("SteamGridDB key", settingsStatus?.credentials.STEAMGRIDDB_API_KEY)}</span>
        </div>
        <div className="settings-grid">
          <label>IGDB client ID<input value={settings.IGDB_CLIENT_ID} onChange={event => actions.setSettings({ ...settings, IGDB_CLIENT_ID: event.target.value })} /></label>
          <label>IGDB client secret<input type="password" value={settings.IGDB_CLIENT_SECRET} onChange={event => actions.setSettings({ ...settings, IGDB_CLIENT_SECRET: event.target.value })} /></label>
          <label>IGDB access token<input type="password" value={settings.IGDB_ACCESS_TOKEN} onChange={event => actions.setSettings({ ...settings, IGDB_ACCESS_TOKEN: event.target.value })} /></label>
          <label>SteamGridDB API key<input type="password" value={steamGridDbKey} onChange={event => actions.setSteamGridDbKey(event.target.value)} /></label>
        </div>
        <div className="settings-actions">
          <button type="button" onClick={actions.saveSettings}>Save settings</button>
          <button type="button" className="secondary" onClick={actions.testCredentials}>Test credentials</button>
          <button type="button" className="secondary" onClick={actions.clearCredentials}>Clear credentials</button>
        </div>
      </section>}
      {tab === "Sync" && <SyncSettingsPanel workflow={syncWorkflow} />}
      {tab === "Diagnostics" && <section className="settings-section">
        <h3>Diagnostics</h3>
        <p className="journal-section-subtitle">If something goes wrong, this log records what the app was doing.</p>
        <div className="settings-panel">
          <p>{diagnosticsLogPath || "The diagnostics log path is available in the desktop app."}</p>
          <div className="settings-actions">
            <button type="button" className="secondary" onClick={() => void onOpenDiagnosticsLog?.()} disabled={!onOpenDiagnosticsLog}>Open diagnostics log</button>
          </div>
        </div>
      </section>}
      </div>
    </FramedPanel>
  );
}

function keysNeedAttention(status: SettingsStatus | undefined) {
  if (!status) return false;
  return status.credentialStatus.status !== "ready" || Object.values(status.credentials).some(credential => credential.unreadable);
}

function credentialLabel(name: string, credential: SavedCredential | undefined) {
  if (credential?.saved) return `${name} saved`;
  if (credential?.unreadable) return `${name} can no longer be read - enter it again`;
  return `${name} not saved`;
}
