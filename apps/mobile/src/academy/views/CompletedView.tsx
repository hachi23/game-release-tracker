import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  RATING_CATEGORIES,
  computeAverageRating,
  parseCategoryScore,
  type CompletedRatingBreakdown,
  type RatingCategoryKey
} from "../../../../../shared/completedRatings";
import type { CompletedGameListItem } from "../../../../../shared/types";
import { igdbCoverSrc } from "../../../../frontend/src/artwork";
import { groupCompletedGames } from "../../../../frontend/src/completedGroups";
import type { AcademyContext } from "../AcademyApp";
import {
  CompletedBinderGrid,
  CompletedGradedSlab,
  formatScore,
  formatShortFinished
} from "../CompletedBinderSlab";
import { Empty, Icon } from "../ui";

// Completed: 9-Pocket Collector's Binder + Certified Graded Slab (side-by-side on wide screens,
// tap-to-open bottom sheet on phones), with a Binder/List toggle and 4-category Add Completed sheet.

type ViewMode = "binder" | "list";

const sortNewestFirst = (items: CompletedGameListItem[]) => [...items].sort((a, b) => {
  const keyA = a.completionDate ?? (a.completionMonth ? `${a.completionMonth}-00` : a.completionYear ? `${a.completionYear}-00-00` : "0000-00-00");
  const keyB = b.completionDate ?? (b.completionMonth ? `${b.completionMonth}-00` : b.completionYear ? `${b.completionYear}-00-00` : "0000-00-00");
  return keyB.localeCompare(keyA) || a.title.localeCompare(b.title);
});

const emptyCategories = (): Record<RatingCategoryKey, string> => ({
  story: "",
  combat: "",
  art: "",
  pacing: ""
});

export function CompletedView({ context }: { context: AcademyContext }) {
  const { api, today, wide, fail, openCompleted, notify } = context;
  const [items, setItems] = useState<CompletedGameListItem[] | null>(null);
  const [allYears, setAllYears] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("binder");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    userPlatform: "PC",
    ratingRaw: "",
    completionDate: "",
    notes: "",
    categories: emptyCategories()
  });

  const load = useCallback(async () => {
    try {
      const result = await api.listCompletedGames({
        search: search.trim() || undefined,
        year: year || undefined
      });
      const ordered = sortNewestFirst(result.items);
      setItems(ordered);
      if (!search.trim() && !year) {
        const distinct = [...new Set(ordered.map(entry => entry.completionYear).filter((value): value is number => Boolean(value)))]
          .sort((a, b) => b - a);
        setAllYears(distinct);
      }
    } catch (error) {
      fail(error);
    }
  }, [api, search, year, fail]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 180 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const groups = useMemo(() => groupCompletedGames(items ?? []), [items]);
  const list = useMemo(() => groups.flatMap(group => group.items), [groups]);
  const certNumberById = useMemo(() => {
    const map = new Map<string, number>();
    list.forEach((game, index) => map.set(game.id, Math.max(1, list.length - index)));
    return map;
  }, [list]);
  const selectedIndex = useMemo(() => {
    if (!list.length) return -1;
    const found = selectedId ? list.findIndex(entry => entry.id === selectedId) : -1;
    return found >= 0 ? found : 0;
  }, [list, selectedId]);
  const selectedGame = selectedIndex >= 0 ? list[selectedIndex] : null;

  const yearChoices = useMemo(() => {
    if (allYears.length) return allYears.slice(0, 6).map(String);
    const thisYear = today.getFullYear();
    return [thisYear, thisYear - 1, thisYear - 2].map(String);
  }, [allYears, today]);

  const thisYearCount = list.filter(entry => entry.completionYear === today.getFullYear()).length;

  const saveRatings = async (gameId: string, breakdown: CompletedRatingBreakdown) => {
    try {
      const { item } = await api.patchCompletedGame(gameId, { ratingBreakdown: breakdown });
      setItems(current => current?.map(entry => (entry.id === item.id ? {
        ...entry,
        ratingScore: item.ratingScore,
        ratingRaw: item.ratingRaw,
        ratingBreakdown: item.ratingBreakdown,
        notes: item.notes
      } : entry)) ?? null);
    } catch (error) {
      fail(error);
    }
  };

  const draftBreakdown: CompletedRatingBreakdown = {
    story: parseCategoryScore(draft.categories.story),
    combat: parseCategoryScore(draft.categories.combat),
    art: parseCategoryScore(draft.categories.art),
    pacing: parseCategoryScore(draft.categories.pacing)
  };
  const draftAvg = computeAverageRating(draftBreakdown);

  const add = async () => {
    try {
      const payload: Record<string, unknown> = {
        title: draft.title,
        userPlatform: draft.userPlatform,
        ratingRaw: draftAvg !== null ? draftAvg.toFixed(1) : (draft.ratingRaw || null),
        completionDate: draft.completionDate || null,
        notes: draft.notes.trim() || null
      };
      if (draftAvg !== null) payload.ratingBreakdown = draftBreakdown;
      const { item } = await api.createManualCompletedGame(payload);
      setAdding(false);
      setDraft({
        title: "",
        userPlatform: draft.userPlatform,
        ratingRaw: "",
        completionDate: "",
        notes: "",
        categories: emptyCategories()
      });
      notify(`${item.title} is in your Completed Library.`);
      setSelectedId(item.id);
      void load();
    } catch (error) {
      fail(error);
    }
  };

  const selectFromBinder = (game: CompletedGameListItem) => {
    setSelectedId(game.id);
    if (!wide) setSheetOpen(true);
  };

  const stepSlab = (delta: number) => {
    const nextIdx = selectedIndex + delta;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    setSelectedId(list[nextIdx].id);
  };

  const leftPane = (
    <section className="stack" aria-label="Completed games">
      <div className="page-head" style={{ flexWrap: "nowrap", gap: 8 }}>
        <h1>Completed</h1>
        <div className="m-toggle" role="group" aria-label="Completed view mode">
          <button type="button" aria-pressed={viewMode === "binder"} onClick={() => setViewMode("binder")}>Binder</button>
          <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>List</button>
        </div>
        <button type="button" className="btn small ribbon-blue icon-btn" aria-label="Add completed game" onClick={() => setAdding(true)}>
          <Icon name="plus" size={17} />
        </button>
      </div>

      {items ? (
        <div className="m-binder__head">
          <span className="page-note">
            {items.length} {items.length === 1 ? "game" : "games"}{year ? ` in ${year}` : ` — ${thisYearCount} this year`}
          </span>
          {groups.length > 0 ? (
            <span className="m-binder__folio-pill">
              {groups.length} {groups.length === 1 ? "MONTH" : "MONTHS"}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="search">
        <label className="sr-only" htmlFor="completed-search">Search completed games</label>
        <input
          id="completed-search"
          className="input"
          type="search"
          placeholder="Title, developer, notes…"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>

      <div className="chips" style={{ flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
        <button type="button" className="chip" style={{ flex: "none" }} aria-pressed={!year} onClick={() => setYear("")}>All years</button>
        {yearChoices.map(value => (
          <button key={value} type="button" className="chip" style={{ flex: "none" }} aria-pressed={year === value} onClick={() => setYear(value)}>
            {value}
          </button>
        ))}
      </div>

      {items !== null && items.length === 0 ? (
        <Empty>No finished games match this filter.</Empty>
      ) : viewMode === "binder" && items ? (
        <CompletedBinderGrid
          groups={groups}
          selectedId={selectedGame?.id ?? null}
          certNumberById={certNumberById}
          onSelect={selectFromBinder}
        />
      ) : items ? (
        <div className="ruled">
          {groups.map(group => (
            <section key={group.key} aria-label={group.heading}>
              <h2>{group.heading} <small style={{ fontSize: 13, fontWeight: 600, opacity: 0.72 }}>· {group.items.length}</small></h2>
              {group.items.map(game => {
                const score = formatScore(game.ratingScore, game.ratingRaw);
                return (
                  <button
                    key={game.id}
                    type="button"
                    className="line-row"
                    aria-selected={wide && selectedGame?.id === game.id}
                    onClick={() => {
                      if (wide) setSelectedId(game.id);
                      else openCompleted(game.id);
                    }}
                  >
                    <span className="line-row__thumb">
                      {game.coverImageId ? <img src={igdbCoverSrc(game.coverImageId, "big")} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="line-row__info">
                      <span className="title">{game.title}</span>
                      <span className="line-row__sub">{[game.userPlatform, formatShortFinished(game)].filter(Boolean).join(" · ")}</span>
                    </span>
                    {score !== "–" ? <span className="line-row__grade">{score}</span> : null}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );

  return (
    <>
      {wide ? (
        <div className="two-pages">
          {leftPane}
          {selectedGame ? (
            <CompletedGradedSlab
              game={selectedGame}
              certNumber={Math.max(1, list.length - selectedIndex)}
              onSaveRatings={saveRatings}
              onOpenDetail={openCompleted}
            />
          ) : (
            <Empty>Select a game from your binder to inspect its Certified Graded Slab.</Empty>
          )}
        </div>
      ) : (
        leftPane
      )}

      {!wide && sheetOpen && selectedGame ? createPortal(
        <div className="m-slab-backdrop" role="dialog" aria-modal="true" aria-label={`Graded slab for ${selectedGame.title}`} onClick={() => setSheetOpen(false)}>
          <div className="m-slab-sheet" onClick={event => event.stopPropagation()}>
            <CompletedGradedSlab
              game={selectedGame}
              certNumber={Math.max(1, list.length - selectedIndex)}
              onSaveRatings={saveRatings}
              onOpenDetail={id => {
                setSheetOpen(false);
                openCompleted(id);
              }}
              onPrev={selectedIndex > 0 ? () => stepSlab(-1) : null}
              onNext={selectedIndex < list.length - 1 ? () => stepSlab(1) : null}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </div>,
        document.body
      ) : null}

      {adding ? createPortal(
        <div className="m-slab-backdrop" role="dialog" aria-modal="true" aria-label="Add completed game" onClick={() => setAdding(false)}>
          <div className="m-slab-sheet" onClick={event => event.stopPropagation()}>
            <div className="page-head" style={{ marginBottom: 4 }}>
              <h1 style={{ fontSize: 22 }}>Add finished game</h1>
              <button type="button" className="btn tiny" onClick={() => setAdding(false)}>Close</button>
            </div>
            <form className="stack" onSubmit={event => { event.preventDefault(); void add(); }}>
              <label className="field">
                <span>Title</span>
                <input className="input" required placeholder="Game title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
              </label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Played on</span>
                  <input className="input" value={draft.userPlatform} onChange={event => setDraft({ ...draft, userPlatform: event.target.value })} />
                </label>
                <label className="field" style={{ width: 112 }}>
                  <span>Overall (opt.)</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder={draftAvg !== null ? draftAvg.toFixed(1) : "9.0"}
                    value={draftAvg !== null ? draftAvg.toFixed(1) : draft.ratingRaw}
                    readOnly={draftAvg !== null}
                    onChange={event => setDraft({ ...draft, ratingRaw: event.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span>Finished on</span>
                <input className="input" type="date" value={draft.completionDate} onChange={event => setDraft({ ...draft, completionDate: event.target.value })} />
              </label>

              <div className="m-cat-editor">
                <div className="m-cat-editor__head">
                  <span className="m-cat-editor__title">4-Category Ratings (0–10)</span>
                  <span className="m-cat-editor__preview">
                    {draftAvg !== null ? `Auto-avg ${draftAvg.toFixed(1)}` : "Auto-averaged"}
                  </span>
                </div>
                <div className="m-cat-grid">
                  {RATING_CATEGORIES.map(category => {
                    const num = parseCategoryScore(draft.categories[category.key]);
                    const inputId = `add-cat-${category.key}`;
                    return (
                      <div key={category.key} className="m-cat-editor__row">
                        <div className="m-cat-editor__label">
                          <label htmlFor={inputId}>{category.label}</label>
                          <input
                            id={inputId}
                            className="m-cat-num"
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={draft.categories[category.key]}
                            onChange={event => {
                              const nextValue = event.currentTarget.value;
                              setDraft(current => ({
                                ...current,
                                categories: { ...current.categories, [category.key]: nextValue }
                              }));
                            }}
                          />
                        </div>
                        <input
                          type="range"
                          className="m-cat-range"
                          min={0}
                          max={10}
                          step={0.5}
                          aria-label={`${category.label} slider`}
                          value={num ?? 0}
                          onChange={event => {
                            const nextValue = event.currentTarget.value;
                            setDraft(current => ({
                              ...current,
                              categories: { ...current.categories, [category.key]: nextValue }
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="field">
                <span>Notes</span>
                <textarea className="input" placeholder="Memorable moments, thoughts…" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} />
              </label>
              <button type="submit" className="btn solid" disabled={!draft.title.trim()}>Save completed game</button>
            </form>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
