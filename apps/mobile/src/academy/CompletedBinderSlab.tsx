import { useEffect, useState } from "react";
import {
  RATING_CATEGORIES,
  computeAverageRating,
  countFilledCategories,
  gradeTierLabel,
  hasAnyCategoryRating,
  parseCategoryScore,
  type CompletedRatingBreakdown,
  type RatingCategoryKey
} from "../../../../shared/completedRatings";
import type { CompletedGameListItem } from "../../../../shared/types";
import { igdbCoverSrc } from "../../../frontend/src/artwork";
import { parseDay, ratingLabel } from "./format";

export const BINDER_PAGE_SIZE = 9;

type DraftBreakdown = Record<RatingCategoryKey, string>;

function toDraft(breakdown: CompletedRatingBreakdown | null | undefined): DraftBreakdown {
  return {
    story: breakdown?.story !== null && breakdown?.story !== undefined ? String(breakdown.story) : "",
    combat: breakdown?.combat !== null && breakdown?.combat !== undefined ? String(breakdown.combat) : "",
    art: breakdown?.art !== null && breakdown?.art !== undefined ? String(breakdown.art) : "",
    pacing: breakdown?.pacing !== null && breakdown?.pacing !== undefined ? String(breakdown.pacing) : ""
  };
}

function draftToBreakdown(draft: DraftBreakdown): CompletedRatingBreakdown {
  return {
    story: parseCategoryScore(draft.story),
    combat: parseCategoryScore(draft.combat),
    art: parseCategoryScore(draft.art),
    pacing: parseCategoryScore(draft.pacing)
  };
}

export function formatShortFinished(game: Pick<CompletedGameListItem, "completionDate" | "completionMonth" | "completionYear">): string {
  const day = parseDay(game.completionDate);
  if (day) return day.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (game.completionMonth) {
    const monthDay = parseDay(`${game.completionMonth}-01`);
    if (monthDay) return monthDay.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return game.completionYear ? String(game.completionYear) : "—";
}

export function formatScore(score: number | null | undefined, raw?: string | null): string {
  if (score !== null && score !== undefined && Number.isFinite(score)) return score.toFixed(1);
  return ratingLabel(score, raw);
}

// 4-category breakdown bars + touch-friendly inline quick editor.
export function CategoryRatingBlock({
  gameId,
  breakdown,
  onSave,
  compact = false
}: {
  gameId: string;
  breakdown: CompletedRatingBreakdown | null | undefined;
  onSave: (next: CompletedRatingBreakdown) => Promise<void> | void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftBreakdown>(() => toDraft(breakdown));

  useEffect(() => {
    setEditing(false);
    setSaving(false);
    setDraft(toDraft(breakdown));
  }, [gameId]);

  useEffect(() => {
    if (!editing) setDraft(toDraft(breakdown));
  }, [breakdown, editing]);

  const parsed = draftToBreakdown(draft);
  const liveAvg = computeAverageRating(parsed);
  const filledCount = countFilledCategories(parsed);
  const hasAny = hasAnyCategoryRating(breakdown);

  const openEditor = () => {
    setDraft(toDraft(breakdown));
    setEditing(true);
  };

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="m-cat-editor" aria-label="Edit 4-category ratings">
        <div className="m-cat-editor__head">
          <span className="m-cat-editor__title">4-Category Ratings</span>
          <span className="m-cat-editor__preview">
            {liveAvg !== null ? `Avg ${liveAvg.toFixed(1)} (${filledCount}/4)` : "No categories"}
          </span>
        </div>
        <div className="m-cat-editor__rows">
          {RATING_CATEGORIES.map(category => {
            const numeric = parseCategoryScore(draft[category.key]);
            const inputId = `m-cat-${gameId}-${category.key}`;
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
                    aria-label={category.label}
                    value={draft[category.key]}
                    onChange={event => {
                      const nextValue = event.currentTarget.value;
                      setDraft(current => ({ ...current, [category.key]: nextValue }));
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
                  value={numeric ?? 0}
                  onChange={event => {
                    const nextValue = event.currentTarget.value;
                    setDraft(current => ({ ...current, [category.key]: nextValue }));
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="m-cat-editor__actions">
          <button type="button" className="btn solid small" disabled={saving} onClick={() => void commit()}>
            {saving ? "Saving…" : "Save ratings"}
          </button>
          <button type="button" className="btn small" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
          <button
            type="button"
            className="link-btn"
            disabled={saving}
            onClick={() => setDraft({ story: "", combat: "", art: "", pacing: "" })}
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-cat-bars">
      <div
        className="m-cat-bars__list"
        role="button"
        tabIndex={0}
        aria-label="Edit 4-category ratings"
        onClick={openEditor}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEditor();
          }
        }}
      >
        {RATING_CATEGORIES.map(category => {
          const val = breakdown?.[category.key] ?? null;
          const pct = val !== null ? Math.max(0, Math.min(100, val * 10)) : 0;
          return (
            <div key={category.key}>
              <div className="m-cat-bar__meta">
                <span>{category.label}</span>
                <span className={`m-cat-bar__val${val === null ? " m-cat-bar__val--empty" : ""}`}>
                  {val !== null ? val.toFixed(1) : "—"}
                </span>
              </div>
              <div className="m-cat-bar__track" aria-hidden="true">
                <div className="m-cat-bar__fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="m-cat-bars__foot">
        <button type="button" className="link-btn" onClick={openEditor}>
          {hasAny ? "✎ Edit ratings" : compact ? "+ Add category ratings" : "+ Add 4-category ratings"}
        </button>
      </div>
    </div>
  );
}

// 9-Pocket Collector's Binder grid (3x3 cards per folio).
export function CompletedBinderGrid({
  items,
  selectedId,
  page,
  totalCount,
  onPageChange,
  onSelect
}: {
  items: CompletedGameListItem[];
  selectedId: string | null;
  page: number;
  totalCount: number;
  onPageChange: (nextPage: number) => void;
  onSelect: (game: CompletedGameListItem) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / BINDER_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * BINDER_PAGE_SIZE;
  const pageItems = items.slice(start, start + BINDER_PAGE_SIZE);
  const emptyCount = Math.max(0, BINDER_PAGE_SIZE - pageItems.length);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="m-binder">
      <div className="m-binder__grid" role="listbox" aria-label="Completed games binder">
        {pageItems.map((game, index) => {
          const globalIndex = start + index;
          const certNumber = Math.max(1, totalCount - globalIndex);
          const isMaster = (game.ratingScore ?? 0) >= 9.5;
          const isSelected = game.id === selectedId;
          const scoreLabel = formatScore(game.ratingScore, game.ratingRaw);
          return (
            <button
              key={game.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`m-tcg${isMaster ? " m-tcg--master" : ""}${isSelected ? " m-tcg--selected" : ""}`}
              onClick={() => onSelect(game)}
            >
              <div className="m-tcg__art">
                {game.coverImageId ? (
                  <img src={igdbCoverSrc(game.coverImageId, "big")} alt={`${game.title} cover`} />
                ) : (
                  <div className="m-tcg__blank" aria-hidden="true">{game.title.slice(0, 1).toUpperCase()}</div>
                )}
                {game.userPlatform ? <span className="m-tcg__plat">{game.userPlatform}</span> : null}
                {scoreLabel !== "–" ? <span className="m-tcg__score">{scoreLabel}</span> : null}
              </div>
              <div className="m-tcg__foot">
                <span className="m-tcg__title">{game.title}</span>
                <span className="m-tcg__meta">
                  <span>#{certNumber}</span>
                  <span>{formatShortFinished(game)}</span>
                </span>
              </div>
            </button>
          );
        })}
        {Array.from({ length: emptyCount }, (_, idx) => (
          <div key={`empty-${idx}`} className="m-tcg__empty" aria-hidden="true" />
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="m-binder__pager">
          <button
            type="button"
            className="btn tiny"
            disabled={safePage <= 0}
            onClick={() => onPageChange(safePage - 1)}
          >
            ← Prev
          </button>
          <span className="m-binder__folio-pill">FOLIO {pad(safePage + 1)} / {pad(totalPages)}</span>
          <button
            type="button"
            className="btn tiny"
            disabled={safePage >= totalPages - 1}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Certified Graded Slab (used side-by-side on wide screens and in a bottom sheet on phones).
export function CompletedGradedSlab({
  game,
  certNumber,
  onSaveRatings,
  onOpenDetail,
  onPrev,
  onNext,
  onClose
}: {
  game: CompletedGameListItem;
  certNumber: number;
  onSaveRatings: (gameId: string, breakdown: CompletedRatingBreakdown) => Promise<void> | void;
  onOpenDetail: (gameId: string) => void;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  onClose?: (() => void) | null;
}) {
  const scoreLabel = formatScore(game.ratingScore, game.ratingRaw);
  const tier = gradeTierLabel(game.ratingScore);
  const genres = (game.igdbGenres.length ? game.igdbGenres : game.genres).slice(0, 3);
  const certCode = String(certNumber).padStart(5, "0");
  const finishedShort = formatShortFinished(game);
  const editionYear = game.completionYear ? `${game.completionYear} EDITION` : "ARCHIVE EDITION";
  const subtitleParts = [game.userPlatform, finishedShort !== "—" ? finishedShort : null].filter(Boolean);

  return (
    <section className="m-slab" aria-label={`Certified Graded Slab for ${game.title}`}>
      <div className="m-slab-sheet__bar">
        <span className="m-slab__kicker">CERTIFIED GRADED SLAB · #{certNumber}</span>
        {onClose ? (
          <button type="button" className="btn tiny" onClick={onClose}>Close</button>
        ) : null}
      </div>

      <div className="m-slab__case">
        <header className="m-slab__header">
          <div style={{ minWidth: 0 }}>
            <span className="m-slab__edition">GAME TRACKER ARCHIVE · {editionYear}</span>
            <h2 className="m-slab__title">{game.title}</h2>
            {subtitleParts.length ? <span className="m-slab__sub">{subtitleParts.join(" · ")}</span> : null}
          </div>
          <div className={`m-slab__grade${scoreLabel === "–" ? " m-slab__grade--none" : ""}`}>
            <strong>{scoreLabel === "–" ? "—" : scoreLabel}</strong>
            <span>{tier}</span>
          </div>
        </header>

        <div className="m-slab__body">
          <div className="m-slab__profile">
            <figure className="m-slab__cover">
              <div className="m-slab__cover-art">
                {game.coverImageId ? (
                  <img src={igdbCoverSrc(game.coverImageId, "big")} alt={`${game.title} cover`} />
                ) : (
                  <div className="m-tcg__blank" aria-hidden="true">{game.title.slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <figcaption className="m-slab__cert">
                <span>CERT #{certCode}</span>
                <span>{finishedShort.toUpperCase()}</span>
              </figcaption>
            </figure>

            {genres.length ? (
              <div className="m-slab__genres">
                <span className="m-slab__genres-label">Genres</span>
                <div className="chips">
                  {genres.map(genre => <span key={genre} className="tag">{genre}</span>)}
                </div>
                {game.developer || game.publisher ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {[game.developer, game.publisher].filter(Boolean).slice(0, 2).join(" · ")}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="m-slab__breakdown">
            <CategoryRatingBlock
              gameId={game.id}
              breakdown={game.ratingBreakdown}
              onSave={next => onSaveRatings(game.id, next)}
              compact
            />
          </div>
        </div>

        <footer className="m-slab__footer">
          {game.notes ? <p className="m-slab__notes">“{game.notes}”</p> : null}
          <div className="m-slab__actions">
            {onPrev || onNext ? (
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn tiny icon-btn" disabled={!onPrev} aria-label="Previous game" onClick={() => onPrev?.()}>‹</button>
                <button type="button" className="btn tiny icon-btn" disabled={!onNext} aria-label="Next game" onClick={() => onNext?.()}>›</button>
              </div>
            ) : <span />}
            <button type="button" className="btn solid small" onClick={() => onOpenDetail(game.id)}>
              Open full entry →
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
