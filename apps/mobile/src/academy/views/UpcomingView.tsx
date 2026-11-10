import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReleaseListItem, SyncStatus } from "../../../../../shared/types";
import type { AcademyContext } from "../AcademyApp";
import { circledCountdown, countdown, groupByMonth, longDate } from "../format";
import { Circled, Empty, Icon, Polaroid, coverOf } from "../ui";
import { AddReleaseSheet } from "./AddReleaseSheet";

// Upcoming: the releases written down the ruled page, grouped by month, with the days to go in red ink
// when they are close. On a wide screen the right-hand page shows the selected game.

export function UpcomingView({ context }: { context: AcademyContext }) {
  const { api, today, wide, fail, openRelease } = context;
  const [items, setItems] = useState<ReleaseListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [adding, setAdding] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, demo] = await Promise.all([api.listReleases({ search: search.trim() || undefined, watchedOnly: watchedOnly || undefined }), api.getDemo()]);
      setItems(list.items);
      setSampleLoaded(demo.loaded);
    } catch (error) {
      fail(error);
    }
  }, [api, search, watchedOnly, fail]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    void api.getSyncStatus().then(setSync).catch(() => undefined);
  }, [api]);

  // Poll while a sync runs, then reload the list.
  useEffect(() => {
    if (sync?.status !== "running") return;
    const timer = setInterval(async () => {
      const next = await api.getSyncStatus();
      setSync(next);
      if (next.status !== "running") void load();
    }, 2000);
    return () => clearInterval(timer);
  }, [api, sync?.status, load]);

  const groups = useMemo(() => groupByMonth(items ?? [], today), [items, today]);
  const current = items?.find(item => item.id === selected) ?? (wide ? items?.[0] : undefined);
  const sameDay = current?.releaseDate ? (items ?? []).filter(item => item.id !== current.id && item.releaseDate === current.releaseDate) : [];

  const syncNow = async () => {
    try {
      setSync(await api.syncNow());
    } catch (error) {
      fail(error);
    }
  };

  const choose = (item: ReleaseListItem) => {
    if (wide) setSelected(item.id);
    else openRelease(item.id);
  };

  const list = (
    <section className="stack" aria-label="Upcoming releases">
      <div className="page-head">
        <h1>Upcoming</h1>
        <button type="button" className="btn small ribbon-blue" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add game</button>
      </div>
      <div className="search">
        <label className="sr-only" htmlFor="upcoming-search">Search</label>
        <input id="upcoming-search" className="input" type="search" placeholder="Title, publisher, DLC…" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="row">
        <button type="button" className="chip" aria-pressed={watchedOnly} onClick={() => setWatchedOnly(value => !value)}>★ Watched only</button>
        <button type="button" className="chip" onClick={syncNow} disabled={sync?.status === "running"}>
          {sync?.status === "running" ? "Syncing…" : "Sync now"}
        </button>
        {sync && sync.status !== "running" && sync.status !== "idle" && sync.message ? <span className="muted" style={{ fontSize: 13 }}>{sync.message}</span> : null}
      </div>

      {items === null ? null : items.length === 0 ? (
        search || watchedOnly ? (
          <Empty>Nothing on this page matches.</Empty>
        ) : (
          <Empty action={<button type="button" className="btn solid" onClick={async () => { try { await api.loadDemo(); await load(); } catch (error) { fail(error); } }}>Load the sample library</button>}>
            Your notebook is empty. Add IGDB keys in Settings and sync, or try the sample library.
          </Empty>
        )
      ) : (
        <div className="ruled">
          {groups.map(group => (
            <div key={group.name}>
              <h2>{group.name}</h2>
              {group.items.map(item => {
                const when = countdown(item, today);
                return (
                  <button key={item.id} type="button" className="line-row" aria-selected={current?.id === item.id} onClick={() => choose(item)}>
                    {item.watched ? <span className="star" aria-label="Watched">★</span> : null}
                    <span className="title">{item.title}</span>
                    <span className={`when${when.days !== null && when.days <= 14 ? " soon" : ""}`}>{when.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {sampleLoaded && items?.length ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>You're looking at the sample library. Remove it in Settings.</p> : null}
    </section>
  );

  return (
    <>
      {wide ? (
        <div className="two-pages">
          {list}
          {current ? <SelectedPage item={current} sameDay={sameDay} context={context} onChanged={load} /> : <div />}
        </div>
      ) : (
        list
      )}
      {adding ? <AddReleaseSheet context={context} onClose={() => setAdding(false)} onAdded={id => { setAdding(false); void load(); openRelease(id); }} /> : null}
    </>
  );
}

function SelectedPage({ item, sameDay, context, onChanged }: { item: ReleaseListItem; sameDay: ReleaseListItem[]; context: AcademyContext; onChanged: () => void }) {
  const { api, today, fail, openRelease } = context;
  const watch = async () => {
    try {
      await api.patchRelease(item.id, { watched: !item.watched });
      onChanged();
    } catch (error) {
      fail(error);
    }
  };
  return (
    <section className="stack" aria-label="Selected game">
      <div className="row" style={{ alignItems: "flex-start", gap: 20, flexWrap: "nowrap" }}>
        <Polaroid src={coverOf(item.artworks)} tilt={-2} tape width={170} />
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          {item.genres.length ? <span className="tag" style={{ alignSelf: "flex-start" }}>{item.genres.slice(0, 2).join(" · ")}</span> : null}
          <h2 className="display" style={{ margin: 0, fontSize: 28, lineHeight: 1.08 }}>{item.title}</h2>
          <div className="muted">{[item.publishers.join(", "), item.developers.join(", ")].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 18 }}>
        <Circled>{circledCountdown(item, today)}</Circled>
        <div>
          <div style={{ fontWeight: 700 }}>{longDate(item.releaseDate) ?? item.dateText}</div>
          <div className="muted">{item.platforms.join(" · ")}</div>
        </div>
      </div>
      {item.lastDateChange ? <p className="sticky">{item.lastDateChange.kind === "delayed" ? "Delayed" : "Moved"} from {item.lastDateChange.fromText}.</p> : null}
      {sameDay.length ? <p className="sticky">Same release day as {sameDay.slice(0, 2).map(other => other.title).join(" and ")}{sameDay.length > 2 ? ` and ${sameDay.length - 2} more` : ""}.</p> : null}
      <div className="row">
        <button type="button" className="btn solid" onClick={() => openRelease(item.id)}>Open details</button>
        <button type="button" className="btn" onClick={watch}>{item.watched ? "★ Watching" : "☆ Watch"}</button>
      </div>
    </section>
  );
}
