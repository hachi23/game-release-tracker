import { useEffect, useRef, useState } from "react";
import type { RandomizerFilters, RandomizerHistoryItem, RandomizerOptions, RandomizerSpinResponse } from "../../../../../shared/types";
import { igdbCoverSrc } from "../../../../frontend/src/artwork";
import type { AcademyContext } from "../AcademyApp";
import { Polaroid } from "../ui";

// Randomizer: set a few filters and spin for a game from IGDB (or the sample library without keys).
// The covers flick past like cards before the pick lands.

export function RandomizerView({ context }: { context: AcademyContext }) {
  const { api, fail, wide } = context;
  const [options, setOptions] = useState<RandomizerOptions | null>(null);
  const [filters, setFilters] = useState<RandomizerFilters>({ minRating: 75, hideCompleted: true, hideUpcoming: true });
  const [result, setResult] = useState<RandomizerSpinResponse | null>(null);
  const [reel, setReel] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState<RandomizerHistoryItem[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.randomizerOptions().then(setOptions).catch(() => setOptions(null));
    api.randomizerHistory(8).then(answer => setHistory(answer.items)).catch(() => undefined);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [api]);

  const toggle = (key: "genreIds" | "excludeGenreIds", id: number) => setFilters(current => {
    const list = current[key] ?? [];
    const next = list.includes(id) ? list.filter(value => value !== id) : [...list, id];
    return { ...current, [key]: next.length ? next : undefined };
  });
  const preset = (name: "jrpg" | "anime") => setFilters(current => {
    const list = current.presets ?? [];
    const next = list.includes(name) ? list.filter(value => value !== name) : [...list, name];
    return { ...current, presets: next.length ? next : undefined };
  });

  const spin = async () => {
    setSpinning(true);
    try {
      const answer = await api.spinRandomizer(filters);
      const covers = answer.reels.map(item => item.coverImageId).filter((id): id is string => Boolean(id));
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (covers.length && !reduced) {
        let index = 0;
        await new Promise<void>(resolve => {
          timer.current = setInterval(() => {
            setReel(covers[index++ % covers.length]);
            if (index > 14) {
              if (timer.current) clearInterval(timer.current);
              resolve();
            }
          }, 90);
        });
      }
      setReel(null);
      setResult(answer);
      setHistory((await api.randomizerHistory(8)).items);
    } catch (error) {
      fail(error);
    } finally {
      setSpinning(false);
    }
  };

  const pick = result?.pick;
  const shown = reel ? igdbCoverSrc(reel, "big") : pick?.coverImageId ? igdbCoverSrc(pick.coverImageId, "big") : null;

  return (
    <div className="two-pages">
      <section className="stack">
        <div className="page-head"><h1>Randomizer</h1></div>
        <p className="muted" style={{ margin: 0 }}>{options?.sample ? "No IGDB keys yet, so spins draw from the sample library." : "Set filters if you like, then spin for a random game from IGDB."}</p>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={Boolean(filters.presets?.includes("jrpg"))} onClick={() => preset("jrpg")}>JRPG</button>
          <button type="button" className="chip" aria-pressed={Boolean(filters.presets?.includes("anime"))} onClick={() => preset("anime")}>Anime</button>
          <button type="button" className="chip" aria-pressed={Boolean(filters.madeInJapan)} onClick={() => setFilters({ ...filters, madeInJapan: filters.madeInJapan ? undefined : true })}>Made in Japan</button>
        </div>
        {options?.genres.length ? (
          <details>
            <summary className="hand" style={{ fontSize: 22, color: "var(--blue)", cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Genres</summary>
            <div className="chips">
              {options.genres.map(genre => (
                <button key={genre.id} type="button" className="chip" aria-pressed={Boolean(filters.genreIds?.includes(genre.id))} onClick={() => toggle("genreIds", genre.id)}>{genre.name}</button>
              ))}
            </div>
          </details>
        ) : null}
        <label className="field">
          <span>Lowest IGDB rating: {filters.minRating ?? 0}</span>
          <input type="range" min={0} max={95} step={5} value={filters.minRating ?? 0} onChange={event => setFilters({ ...filters, minRating: Number(event.target.value) || undefined })} style={{ accentColor: "var(--blue)", minHeight: 44 }} />
        </label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.hideCompleted)} onChange={event => setFilters({ ...filters, hideCompleted: event.target.checked || undefined })} /> Hide games in my Completed Library</label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.hideUpcoming)} onChange={event => setFilters({ ...filters, hideUpcoming: event.target.checked || undefined })} /> Hide games in Upcoming</label>
        <label className="check"><input type="checkbox" checked={Boolean(filters.includeRemakes)} onChange={event => setFilters({ ...filters, includeRemakes: event.target.checked || undefined })} /> Include remakes, remasters and ports</label>
      </section>

      <section className="stack" style={{ alignItems: "center", textAlign: "center" }} aria-live="polite">
        {shown ? (
          <Polaroid src={shown} alt={reel ? "" : `${pick?.title} cover`} tilt={2} tape width={wide ? 220 : 180} />
        ) : (
          <div style={{ width: 180, aspectRatio: "3 / 4", border: "2px dashed var(--ink-faint)", display: "grid", placeItems: "center", transform: "rotate(2deg)", background: "var(--sheet)" }}>
            <span className="hand" style={{ fontSize: 80, color: "var(--ink-faint)" }}>?</span>
          </div>
        )}
        {pick && !reel ? (
          <div className="stack" style={{ gap: 6 }}>
            <h2 className="display" style={{ margin: 0, fontSize: 24 }}>{pick.title}</h2>
            <div className="muted">{[pick.releaseYear, pick.genres.slice(0, 2).join(", "), pick.totalRating ? `IGDB ${Math.round(pick.totalRating)}` : null].filter(Boolean).join(" · ")}</div>
            {pick.summary ? <p style={{ margin: 0, textAlign: "left" }}>{pick.summary.length > 320 ? `${pick.summary.slice(0, 320)}…` : pick.summary}</p> : null}
            {pick.url ? <a href={pick.url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>Open on IGDB</a> : null}
          </div>
        ) : null}
        {result && !result.pick && !reel ? <p className="sticky">{result.reason ?? "Nothing matched those filters."}</p> : null}
        <button type="button" className="btn ribbon-blue" style={{ minHeight: 52, padding: "0 50px", letterSpacing: ".08em" }} disabled={spinning} onClick={() => void spin()}>{spinning ? "Spinning…" : "Spin"}</button>
        {history.length ? (
          <div style={{ alignSelf: "stretch", textAlign: "left" }}>
            <h2 className="hand" style={{ margin: "8px 0 0", fontSize: 22, color: "var(--blue)" }}>Recent picks</h2>
            <div className="scroller">
              {history.map(item => <Polaroid key={item.id} src={item.coverImageId ? igdbCoverSrc(item.coverImageId, "big") : null} caption={item.title} width={86} />)}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
