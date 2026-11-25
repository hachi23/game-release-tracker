import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReleaseListItem, SyncStatus } from "../../../../../shared/types";
import { findUpcomingStart } from "../../../../../shared/upcomingStart";
import type { AcademyContext } from "../AcademyApp";
import { circledCountdown, countdown, groupByMonth, longDate } from "../format";
import { getCachedUpcoming, invalidateUpcomingCache, setCachedUpcoming } from "../listCache";
import { Circled, Empty, Icon, Polaroid, coverOf } from "../ui";

const AddReleaseSheet = lazy(() => import("./AddReleaseSheet").then(m => ({ default: m.AddReleaseSheet })));

const INITIAL_UPCOMING_GROUPS = 4;
const UPCOMING_GROUP_STEP = 4;

// Upcoming: chronological releases grouped by month with crisp cover thumbnails for quick scanning
// on phones. On wide screens the right-hand page previews the selected release.

export function UpcomingView({ context }: { context: AcademyContext }) {
  const { api, today, wide, fail, openRelease } = context;
  const cachedInit = getCachedUpcoming();
  const [items, setItems] = useState<ReleaseListItem[] | null>(cachedInit?.items ?? null);
  const [search, setSearch] = useState("");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [genre, setGenre] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [adding, setAdding] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(cachedInit?.sampleLoaded ?? false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [visibleGroups, setVisibleGroups] = useState(INITIAL_UPCOMING_GROUPS);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const load = useCallback(async (force = false) => {
    const unfiltered = !search.trim() && !watchedOnly;
    if (unfiltered && !force) {
      const cached = getCachedUpcoming();
      if (cached) {
        setItems(cached.items);
        setSampleLoaded(cached.sampleLoaded);
        return;
      }
    }
    try {
      const [list, demo] = await Promise.all([
        api.listReleases({ search: search.trim() || undefined, watchedOnly: watchedOnly || undefined }),
        api.getDemo()
      ]);
      setItems(list.items);
      setSampleLoaded(demo.loaded);
      if (unfiltered) setCachedUpcoming(list.items, demo.loaded);
    } catch (error) {
      fail(error);
    }
  }, [api, search, watchedOnly, fail]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    const onCloudSynced = () => void load(true);
    window.addEventListener("grt:cloud-synced", onCloudSynced);
    return () => window.removeEventListener("grt:cloud-synced", onCloudSynced);
  }, [load]);

  useEffect(() => {
    void api.getSyncStatus().then(setSync).catch(() => undefined);
  }, [api]);

  useEffect(() => {
    if (sync?.status !== "running" || syncingRef.current) return;
    const timer = setInterval(async () => {
      try {
        const next = await api.getSyncStatus();
        setSync(next);
        if (next.status !== "running") {
          invalidateUpcomingCache();
          void load(true);
        }
      } catch {
        // Retry on next tick.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [api, sync?.status, load]);

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items ?? []) {
      for (const g of item.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  }, [items]);

  const visible = useMemo(
    () => (genre ? (items ?? []).filter(item => item.genres.includes(genre)) : (items ?? [])),
    [items, genre]
  );

  const groups = useMemo(() => groupByMonth(visible, today), [visible, today]);
  const upcomingStart = useMemo(() => findUpcomingStart(groups, today), [groups, today]);
  const searching = Boolean(search.trim());
  const startGroupIndex = searching || showEarlier ? 0 : upcomingStart.groupIndex;
  const activeGroups = useMemo(() => groups.slice(startGroupIndex), [groups, startGroupIndex]);
  const current = visible.find(item => item.id === selected) ?? (wide ? upcomingStart.item ?? visible[0] : undefined);
  const sameDay = current?.releaseDate ? visible.filter(item => item.id !== current.id && item.releaseDate === current.releaseDate) : [];

  useEffect(() => {
    setVisibleGroups(INITIAL_UPCOMING_GROUPS);
    if (!search.trim()) setShowEarlier(false);
  }, [search, watchedOnly, genre]);

  const hasMoreGroups = visibleGroups < activeGroups.length;
  useEffect(() => {
    if (!hasMoreGroups || typeof IntersectionObserver === "undefined") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisibleGroups(current => Math.min(activeGroups.length, current + UPCOMING_GROUP_STEP));
        }
      },
      { rootMargin: "420px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreGroups, activeGroups.length]);

  const syncNow = async () => {
    if (syncingRef.current || sync?.status === "running") return;
    syncingRef.current = true;
    setSync(current => ({
      added: current?.added ?? 0,
      repaired: current?.repaired ?? 0,
      skipped: current?.skipped ?? 0,
      failed: 0,
      status: "running",
      message: "Syncing…"
    }));
    try {
      const finished = await api.syncNow();
      setSync(finished);
      if (finished.status !== "running") {
        invalidateUpcomingCache();
        await load(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSync(current => ({
        added: current?.added ?? 0,
        repaired: current?.repaired ?? 0,
        skipped: current?.skipped ?? 0,
        failed: 1,
        status: "failed",
        message
      }));
      fail(error);
    } finally {
      syncingRef.current = false;
    }
  };

  const choose = (item: ReleaseListItem) => {
    if (wide) setSelected(item.id);
    else openRelease(item.id);
  };

  const list = (
    <section className="stack" aria-label="Upcoming releases">
      <div className="page-head" style={{ flexWrap: "nowrap" }}>
        <h1>Upcoming</h1>
        <button type="button" className="btn small ribbon-blue" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />Add
        </button>
      </div>
      {items ? <span className="page-note" style={{ marginTop: -6 }}>{visible.length} on the list</span> : null}
      <div className="search">
        <label className="sr-only" htmlFor="upcoming-search">Search</label>
        <input
          id="upcoming-search"
          className="input"
          type="search"
          placeholder="Title, publisher, DLC…"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>
      <div className="row">
        <button type="button" className="chip" aria-pressed={watchedOnly} onClick={() => setWatchedOnly(value => !value)}>★ Watched</button>
        <button type="button" className="chip" onClick={syncNow} disabled={sync?.status === "running"}>
          {sync?.status === "running" ? "Syncing…" : "Sync now"}
        </button>
        {genres.length ? (
          <select
            aria-label="Filter by genre"
            className="chip"
            style={{ paddingRight: 10 }}
            value={genre}
            onChange={event => setGenre(event.target.value)}
          >
            <option value="">All genres</option>
            {genres.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : null}
      </div>
      {sync && sync.status !== "running" && sync.status !== "idle" && sync.message ? (
        <span className="muted" style={{ fontSize: 12.5, color: sync.status === "failed" ? "var(--red)" : undefined }}>{sync.message}</span>
      ) : null}

      {items === null ? null : visible.length === 0 ? (
        search || watchedOnly || genre ? (
          <Empty>Nothing on this page matches.</Empty>
        ) : (
          <Empty action={
            <button type="button" className="btn solid" onClick={async () => { try { await api.loadDemo(); invalidateUpcomingCache(); await load(true); } catch (error) { fail(error); } }}>
              Load the sample library
            </button>
          }>
            Your notebook is empty. Add IGDB keys in Settings and sync, or try the sample library.
          </Empty>
        )
      ) : (
        <div className="ruled">
          {!searching && upcomingStart.earlierGroupCount > 0 ? (
            <div className="m-binder__more" style={{ justifyContent: "flex-start", paddingTop: 0 }}>
              <button
                type="button"
                className="btn tiny"
                onClick={() => {
                  setShowEarlier(value => !value);
                  setVisibleGroups(c => Math.max(c, upcomingStart.earlierGroupCount + INITIAL_UPCOMING_GROUPS));
                }}
              >
                {showEarlier
                  ? "↓ Hide earlier months"
                  : `↑ Show earlier months (${upcomingStart.earlierGroupCount})`}
              </button>
            </div>
          ) : null}
          {activeGroups.slice(0, visibleGroups).map(group => (
            <div key={group.name}>
              <h2>{group.name}</h2>
              {group.items.map(item => {
                const when = countdown(item, today);
                const thumb = coverOf(item.artworks, "small");
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="line-row"
                    aria-selected={current?.id === item.id}
                    onClick={() => choose(item)}
                  >
                    <span className="line-row__thumb">
                      {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" /> : null}
                    </span>
                    <span className="line-row__info">
                      <span className="title">{item.watched ? "★ " : ""}{item.title}</span>
                      <span className="line-row__sub">
                        {[item.publishers[0] ?? item.developers[0], item.platforms.slice(0, 3).join(" · ")].filter(Boolean).join(" — ")}
                      </span>
                    </span>
                    <span className={`when${when.days !== null && when.days <= 14 ? " soon" : ""}`}>{when.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {hasMoreGroups ? (
            <div ref={sentinelRef} className="m-binder__more">
              <button type="button" className="btn tiny" onClick={() => setVisibleGroups(c => Math.min(activeGroups.length, c + UPCOMING_GROUP_STEP))}>
                Load more months ({activeGroups.length - visibleGroups} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}
      {sampleLoaded && items?.length ? <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>You're looking at the sample library. Remove it in Settings.</p> : null}
    </section>
  );

  return (
    <>
      {wide ? (
        <div className="two-pages">
          {list}
          {current ? <SelectedPage item={current} sameDay={sameDay} context={context} onChanged={() => { invalidateUpcomingCache(); void load(true); }} /> : <div />}
        </div>
      ) : (
        list
      )}
      {adding ? (
        <Suspense fallback={null}>
          <AddReleaseSheet context={context} onClose={() => setAdding(false)} onAdded={id => { setAdding(false); invalidateUpcomingCache(); void load(true); openRelease(id); }} />
        </Suspense>
      ) : null}
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
        <Polaroid src={coverOf(item.artworks)} tilt={-1.5} tape width={168} />
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          {item.genres.length ? <span className="tag" style={{ alignSelf: "flex-start" }}>{item.genres.slice(0, 2).join(" · ")}</span> : null}
          <h2 className="display" style={{ margin: 0, fontSize: 26, lineHeight: 1.08 }}>{item.title}</h2>
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
