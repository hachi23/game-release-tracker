import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompletedGameListItem } from "../../../../../shared/types";
import { igdbCoverSrc } from "../../../../frontend/src/artwork";
import { groupCompletedGames } from "../../../../frontend/src/completedGroups";
import type { AcademyContext } from "../AcademyApp";
import { ratingLabel } from "../format";
import { Empty, Icon, Polaroid } from "../ui";

// Completed: the finished games pinned up as graded polaroids under a heading for the month they were
// finished, newest month first and undated games last (the desktop's grouping), filterable by year.

const TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5];

export function CompletedView({ context }: { context: AcademyContext }) {
  const { api, today, fail, openCompleted, notify } = context;
  const [items, setItems] = useState<CompletedGameListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", userPlatform: "PC", ratingRaw: "", completionDate: "" });

  const load = useCallback(async () => {
    try {
      setItems((await api.listCompletedGames({ search: search.trim() || undefined, year: year || undefined })).items);
    } catch (error) {
      fail(error);
    }
  }, [api, search, year, fail]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const years = useMemo(() => {
    const thisYear = today.getFullYear();
    return [thisYear, thisYear - 1, thisYear - 2].map(String);
  }, [today]);
  const groups = useMemo(() => groupCompletedGames(items ?? []), [items]);
  const thisYearCount = items?.filter(item => item.completionYear === today.getFullYear()).length ?? 0;

  const add = async () => {
    try {
      const { item } = await api.createManualCompletedGame({ title: draft.title, userPlatform: draft.userPlatform, ratingRaw: draft.ratingRaw || null, completionDate: draft.completionDate || null });
      setAdding(false);
      setDraft({ title: "", userPlatform: draft.userPlatform, ratingRaw: "", completionDate: "" });
      notify(`${item.title} is in your Completed Library.`);
      void load();
    } catch (error) {
      fail(error);
    }
  };

  return (
    <section className="stack">
      <div className="page-head">
        <h1>Completed</h1>
        <button type="button" className="btn small ribbon-blue" onClick={() => setAdding(value => !value)}><Icon name="plus" size={16} />Add</button>
      </div>
      {items ? <span className="page-note">{items.length} games{year ? ` in ${year}` : ` — ${thisYearCount} this year`}</span> : null}
      {adding ? (
        <form className="sheet stack" onSubmit={event => { event.preventDefault(); void add(); }}>
          <label className="field"><span>Title</span><input className="input" required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 1 }}><span>Played on</span><input className="input" value={draft.userPlatform} onChange={event => setDraft({ ...draft, userPlatform: event.target.value })} /></label>
            <label className="field" style={{ width: 96 }}><span>Grade</span><input className="input" inputMode="decimal" value={draft.ratingRaw} onChange={event => setDraft({ ...draft, ratingRaw: event.target.value })} /></label>
          </div>
          <label className="field"><span>Finished on</span><input className="input" type="date" value={draft.completionDate} onChange={event => setDraft({ ...draft, completionDate: event.target.value })} /></label>
          <button type="submit" className="btn solid" disabled={!draft.title.trim()}>Add to Completed</button>
        </form>
      ) : null}
      <label className="sr-only" htmlFor="completed-search">Search</label>
      <input id="completed-search" className="input" type="search" placeholder="Search your finished games…" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="chips">
        <button type="button" className="chip" aria-pressed={!year} onClick={() => setYear("")}>All years</button>
        {years.map(value => <button key={value} type="button" className="chip" aria-pressed={year === value} onClick={() => setYear(value)}>{value}</button>)}
      </div>
      {items?.length === 0 ? <Empty>No finished games here yet.</Empty> : null}
      {groups.map(group => (
        <section key={group.key} className="completed-month" aria-label={group.heading}>
          <h2>{group.heading}</h2>
          <div className="grid-covers">
            {group.items.map((item, index) => (
              <button key={item.id} type="button" onClick={() => openCompleted(item.id)} aria-label={`${item.title}, rated ${ratingLabel(item.ratingScore, item.ratingRaw)}`}>
                <Polaroid src={item.coverImageId ? igdbCoverSrc(item.coverImageId, "big") : null} tilt={TILTS[index % TILTS.length]} grade={ratingLabel(item.ratingScore, item.ratingRaw)} />
                <span style={{ display: "block", marginTop: 8, fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
