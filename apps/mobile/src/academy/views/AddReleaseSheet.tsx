import { useState } from "react";
import type { ManualReleaseCandidate } from "../../../../../shared/types";
import { manualGameFromCandidate } from "../../../../frontend/src/useReleaseManualGameWorkflow";
import { igdbCoverSrc } from "../../../../frontend/src/artwork";
import type { AcademyContext } from "../AcademyApp";
import { Polaroid } from "../ui";
import { shortDate } from "../format";

// Add game: find it on IGDB and add it, or write one in by hand.

export function AddReleaseSheet({ context, onClose, onAdded }: { context: AcademyContext; onClose: () => void; onAdded: (id: string) => void }) {
  const { api, fail } = context;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManualReleaseCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({ title: "", releaseDate: "", platforms: "" });

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      setResults((await api.searchManualReleaseCandidates(query.trim())).items);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const add = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { item } = await api.createManualRelease(payload);
      if (item.eligible === false) context.notify(`Saved, but it is hidden from Upcoming because ${item.eligibilityReason ?? "it has no upcoming date"}.`);
      onAdded(item.id);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Add game" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(11,16,32,.6)", display: "grid", alignItems: "end", justifyItems: "center" }} onClick={onClose}>
      <div className="stack" style={{ width: "min(640px, 100%)", maxHeight: "88dvh", overflowY: "auto", background: "var(--page)", padding: "20px 16px calc(24px + env(safe-area-inset-bottom))", borderRadius: "14px 14px 0 0", boxShadow: "0 -4px 0 var(--gold)" }} onClick={event => event.stopPropagation()}>
        <div className="page-head">
          <h1>Add game</h1>
          <button type="button" className="btn small" onClick={onClose}>Close</button>
        </div>
        <form className="search" onSubmit={event => { event.preventDefault(); void search(); }}>
          <label className="sr-only" htmlFor="add-search">Find on IGDB</label>
          <input id="add-search" className="input" type="search" placeholder="Find on IGDB…" value={query} onChange={event => setQuery(event.target.value)} />
          <button type="submit" className="btn solid" disabled={busy}>Find</button>
        </form>
        {results?.length === 0 ? <p className="page-note">No match on IGDB. Write it in below.</p> : null}
        {results?.map(candidate => (
          <div key={candidate.igdbId} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Polaroid src={candidate.coverImageId ? igdbCoverSrc(candidate.coverImageId, "big") : null} width={64} tilt={-1} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{candidate.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>{candidate.dateText} · {candidate.platforms.slice(0, 4).join(", ")}</div>
            </div>
            <button type="button" className="btn small ribbon-blue" disabled={busy} onClick={() => void add({ ...manualGameFromCandidate(candidate) })}>Add</button>
          </div>
        ))}
        <h2 className="hand" style={{ margin: "8px 0 0", fontSize: 24, color: "var(--blue)" }}>…or write it in</h2>
        <form className="stack" onSubmit={event => { event.preventDefault(); void add({ title: manual.title, releaseDate: manual.releaseDate, dateText: shortDate(manual.releaseDate) ?? "", platforms: manual.platforms }); }}>
          <label className="field"><span>Title</span><input className="input" required value={manual.title} onChange={event => setManual({ ...manual, title: event.target.value })} /></label>
          <label className="field"><span>Release date</span><input className="input" type="date" value={manual.releaseDate} onChange={event => setManual({ ...manual, releaseDate: event.target.value })} /></label>
          <label className="field"><span>Platforms</span><input className="input" placeholder="PC, PS5, Switch 2" value={manual.platforms} onChange={event => setManual({ ...manual, platforms: event.target.value })} /></label>
          <button type="submit" className="btn solid" disabled={busy || !manual.title.trim()}>Add to Upcoming</button>
        </form>
      </div>
    </div>
  );
}
