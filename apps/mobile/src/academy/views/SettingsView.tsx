import { useEffect, useState } from "react";
import type { PlatformFamily, SettingsStatus, SyncSettings, TrackedPublisher } from "../../../../../shared/types";
import type { AcademyContext } from "../AcademyApp";
import type { TermChoice } from "../term";

// Settings: the look (Day Term / Night Study), IGDB keys, what the sync tracks, and the sample library.

const TERMS: Array<{ id: TermChoice; label: string; note: string }> = [
  { id: "day", label: "Day Term", note: "Parchment in daylight" },
  { id: "night", label: "Night Study", note: "The same notebook by candlelight" },
  { id: "system", label: "Match my phone", note: "Follows Android's dark theme" }
];

const PLATFORMS: Array<{ id: PlatformFamily; label: string }> = [
  { id: "pc", label: "PC" },
  { id: "xbox", label: "Xbox" },
  { id: "playstation", label: "PlayStation" },
  { id: "switch", label: "Nintendo" }
];

export function SettingsView({ context }: { context: AcademyContext }) {
  const { api, term, setTerm, fail, notify } = context;
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [sync, setSync] = useState<SyncSettings | null>(null);
  const [keys, setKeys] = useState({ IGDB_CLIENT_ID: "", IGDB_CLIENT_SECRET: "" });
  const [publisherQuery, setPublisherQuery] = useState("");
  const [publisherResults, setPublisherResults] = useState<TrackedPublisher[]>([]);
  const [sample, setSample] = useState(false);

  useEffect(() => {
    api.getSettings().then(setStatus).catch(fail);
    api.getSyncSettings().then(setSync).catch(fail);
    api.getDemo().then(answer => setSample(answer.loaded)).catch(() => undefined);
  }, [api, fail]);

  const run = async <T,>(work: () => Promise<T>, done?: (value: T) => void) => {
    try {
      const value = await work();
      done?.(value);
    } catch (error) {
      fail(error);
    }
  };

  const saveKeys = () => run(() => api.patchSettings(Object.fromEntries(Object.entries(keys).filter(([, value]) => value.trim()))), answer => {
    setStatus(answer.settings);
    setKeys({ IGDB_CLIENT_ID: "", IGDB_CLIENT_SECRET: "" });
    notify("IGDB keys saved.");
  });
  const updateSync = (patch: Parameters<typeof api.updateSyncSettings>[0]) => run(() => api.updateSyncSettings(patch), setSync);
  const togglePlatform = (id: PlatformFamily) => {
    if (!sync) return;
    const next = sync.platforms.includes(id) ? sync.platforms.filter(value => value !== id) : [...sync.platforms, id];
    if (next.length) void updateSync({ platforms: next });
  };

  return (
    <div className="two-pages">
      <section className="stack">
        <div className="page-head"><h1>Settings</h1></div>
        <h2 className="display" style={{ margin: 0, fontSize: 20 }}>Look</h2>
        <div className="stack" role="radiogroup" aria-label="Look" style={{ gap: 8 }}>
          {TERMS.map(option => (
            <label key={option.id} className="check sheet" style={{ padding: "8px 14px" }}>
              <input type="radio" name="term" checked={term === option.id} onChange={() => setTerm(option.id)} />
              <span><b>{option.label}</b><br /><span className="muted" style={{ fontSize: 13 }}>{option.note}</span></span>
            </label>
          ))}
        </div>

        <h2 className="display" style={{ margin: "8px 0 0", fontSize: 20 }}>IGDB keys</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {status?.credentialStatus.status === "ready" ? "Keys saved." : "Add a Twitch app's client ID and secret (dev.twitch.tv) to sync releases and search IGDB."}
          {" "}Keys stay in this app's private storage on your phone.
        </p>
        <label className="field"><span>Client ID</span><input className="input" autoComplete="off" value={keys.IGDB_CLIENT_ID} placeholder={status?.credentials.IGDB_CLIENT_ID.saved ? "Saved" : ""} onChange={event => setKeys({ ...keys, IGDB_CLIENT_ID: event.target.value })} /></label>
        <label className="field"><span>Client secret</span><input className="input" type="password" autoComplete="off" value={keys.IGDB_CLIENT_SECRET} placeholder={status?.credentials.IGDB_CLIENT_SECRET.saved ? "Saved" : ""} onChange={event => setKeys({ ...keys, IGDB_CLIENT_SECRET: event.target.value })} /></label>
        <div className="row">
          <button type="button" className="btn solid" disabled={!keys.IGDB_CLIENT_ID.trim() && !keys.IGDB_CLIENT_SECRET.trim()} onClick={() => void saveKeys()}>Save keys</button>
          <button type="button" className="btn" onClick={() => void run(() => api.testCredentials(), answer => notify(answer.credentialStatus.status === "ready" ? "IGDB answered. Your keys work." : answer.credentialStatus.message ?? "IGDB didn't accept the keys."))}>Test</button>
          <button type="button" className="btn danger" onClick={() => void run(() => api.clearCredentials(), answer => setStatus(answer.settings))}>Clear</button>
        </div>
      </section>

      <section className="stack">
        <h2 className="display" style={{ margin: 0, fontSize: 20 }}>Sync</h2>
        {sync ? (
          <>
            <div className="chips">
              {PLATFORMS.map(platform => <button key={platform.id} type="button" className="chip" aria-pressed={sync.platforms.includes(platform.id)} onClick={() => togglePlatform(platform.id)}>{platform.label}</button>)}
            </div>
            <label className="field"><span>Track releases from</span><input className="input" type="date" value={sync.trackFrom} onChange={event => event.target.value && void updateSync({ trackFrom: event.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={sync.autoSync} onChange={event => void updateSync({ autoSync: event.target.checked })} /> Sync when I open the app (every 12 hours)</label>
            <label className="check"><input type="checkbox" checked={sync.alerts} onChange={event => void updateSync({ alerts: event.target.checked })} /> Notify me about watched games</label>
            <h3 className="hand" style={{ margin: 0, fontSize: 22, color: "var(--blue)" }}>Publishers I follow</h3>
            {sync.publishers.length ? (
              <div className="chips">
                {sync.publishers.map(publisher => <button key={publisher.id} type="button" className="chip" aria-label={`Stop following ${publisher.name}`} onClick={() => void run(() => api.untrackPublisher(publisher.id), setSync)}>{publisher.name} ✕</button>)}
              </div>
            ) : (
              <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => void run(() => api.trackSuggestedPublishers(), answer => setSync(answer))}>Follow the suggested publishers</button>
            )}
            <form className="search" onSubmit={event => { event.preventDefault(); void run(() => api.searchPublishers(publisherQuery), answer => setPublisherResults(answer.items)); }}>
              <label className="sr-only" htmlFor="publisher-search">Find a publisher</label>
              <input id="publisher-search" className="input" placeholder="Find a publisher…" value={publisherQuery} onChange={event => setPublisherQuery(event.target.value)} />
              <button type="submit" className="btn">Find</button>
            </form>
            {publisherResults.length ? (
              <div className="chips">
                {publisherResults.map(publisher => <button key={publisher.id} type="button" className="chip" onClick={() => void run(() => api.trackPublisher(publisher), next => { setSync(next); setPublisherResults([]); setPublisherQuery(""); })}>+ {publisher.name}</button>)}
              </div>
            ) : null}
          </>
        ) : null}

        <h2 className="display" style={{ margin: "8px 0 0", fontSize: 20 }}>Sample library</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Real games with made-up grades and finish dates, to try the app without IGDB keys.</p>
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => void run(() => (sample ? api.removeDemo() : api.loadDemo()), answer => setSample(answer.loaded))}>
          {sample ? "Remove sample data" : "Load the sample library"}
        </button>
      </section>
    </div>
  );
}
