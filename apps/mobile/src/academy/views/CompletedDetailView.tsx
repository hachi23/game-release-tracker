import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CompletedRatingBreakdown } from "../../../../../shared/completedRatings";
import type { CompletedGameDetail, CompletedGameListItem } from "../../../../../shared/types";
import { igdbCoverSrc, screenshotSrc } from "../../../../frontend/src/artwork";
import type { AcademyContext } from "../AcademyApp";
import { CategoryRatingBlock, formatScore } from "../CompletedBinderSlab";
import { coverTintStyle, useCoverPalette, type DetailBgTint } from "../coverPalette";
import { parseDay, ratingLabel } from "../format";

// Finished game detail page: cover-tinted frosted glass (40% / 60% / 70%) with harmonized cards,
// prominent 16:9 "Screenshots" gallery + lightbox, single-row 10 pushpins + 4-category ratings,
// lined notes, replay tags, and before/after neighbours (no "In one line" or finish-rank clutter).

type Replay = NonNullable<CompletedGameDetail["replay"]>;
const REPLAY: Array<{ value: Replay; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" }
];
const TINTS: DetailBgTint[] = ["40", "60", "70"];

const finishedLabel = (game: Pick<CompletedGameListItem, "completionDate" | "completionMonth" | "completionYear">, withYear = true) => {
  const day = parseDay(game.completionDate);
  if (day) return day.toLocaleDateString(undefined, withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  return game.completionMonth ?? (game.completionYear ? String(game.completionYear) : null);
};

const sortKey = (game: CompletedGameListItem) => game.completionDate ?? (game.completionMonth ? `${game.completionMonth}-99` : game.completionYear ? `${game.completionYear}-99-99` : "9999");

export function CompletedDetailView({ id, context }: { id: string; context: AcademyContext }) {
  const { api, fail, back, openCompleted, detailTint, setDetailTint } = context;
  const [game, setGame] = useState<CompletedGameDetail | null>(null);
  const [library, setLibrary] = useState<CompletedGameListItem[]>([]);
  const [notes, setNotes] = useState("");
  const [shotIndex, setShotIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    setShotIndex(0);
    setLightbox(false);
    api.getCompletedGame(id).then(item => {
      setGame(item);
      setNotes(item.notes ?? "");
    }).catch(fail);
    api.listCompletedGames().then(answer => setLibrary(answer.items)).catch(() => undefined);
  }, [api, id, fail]);

  const coverUrl = game?.coverImageId ? igdbCoverSrc(game.coverImageId, "detail") : null;
  const palette = useCoverPalette(coverUrl);

  const save = async (patch: Record<string, unknown>) => {
    try {
      const { item } = await api.patchCompletedGame(id, patch);
      setGame(item);
      setLibrary(current => current.map(entry => (entry.id === item.id ? { ...entry, ...item } : entry)));
    } catch (error) {
      fail(error);
    }
  };

  const saveNotes = () => {
    if (!game || (game.notes ?? "") === notes) return;
    void save({ notes });
  };

  const saveCategories = async (breakdown: CompletedRatingBreakdown) => {
    await save({ ratingBreakdown: breakdown });
  };

  const neighbours = useMemo(() => {
    if (!game?.completionYear) return null;
    const yearGames = library.filter(entry => entry.completionYear === game.completionYear);
    if (!yearGames.some(entry => entry.id === game.id)) return null;
    const inOrder = [...yearGames].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const index = inOrder.findIndex(entry => entry.id === game.id);
    return {
      before: index > 0 ? inOrder[index - 1] : null,
      after: index >= 0 && index < inOrder.length - 1 ? inOrder[index + 1] : null
    };
  }, [game, library]);

  const remove = async () => {
    if (!window.confirm(`Remove ${game?.title} from your Completed Library?`)) return;
    try {
      await api.deleteCompletedGame(id);
      back();
    } catch (error) {
      fail(error);
    }
  };

  if (!game) return null;

  const score = game.ratingScore ?? 0;
  const grade = formatScore(game.ratingScore, game.ratingRaw);
  const setGrade = (n: number) => void save({ ratingRaw: String(score === n ? n - 0.5 : n) });
  const finished = finishedLabel(game);
  const shots = game.screenshots;
  const activeShot = shots[Math.min(shotIndex, Math.max(0, shots.length - 1))] ?? null;
  const studio = game.igdbDeveloper ?? game.developer;
  const publisher = game.igdbPublisher ?? game.publisher;
  const genres = game.igdbGenres.length ? game.igdbGenres : game.genres;

  const coverColumn = (
    <div className="stack" style={{ gap: 12 }}>
      <div className="m-cork-hero">
        <figure className="m-cork-cover">
          {coverUrl ? <img src={coverUrl} alt={`${game.title} cover`} /> : <div className="blank" aria-hidden="true" />}
          <span className="m-cork-ribbon" aria-label={`Grade ${grade}`}>
            <small>GRADE</small>
            <strong>{grade}</strong>
          </span>
          {finished ? <figcaption>done! {finished}</figcaption> : null}
        </figure>

        <div className="detail-card stack" style={{ gap: 8 }}>
          <h1 className="display" style={{ margin: 0, fontSize: 22, lineHeight: 1.1, overflowWrap: "anywhere" }}>{game.title}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{[game.userPlatform, studio].filter(Boolean).join(" · ")}</div>
          {genres.length ? (
            <div className="chips">
              {genres.slice(0, 4).map(genre => <span key={genre} className="tag">{genre}</span>)}
            </div>
          ) : null}
          {publisher ? <div className="muted" style={{ fontSize: 12 }}>Publisher: {publisher}</div> : null}
        </div>
      </div>
    </div>
  );

  const middleColumn = (
    <div className="stack" style={{ gap: 12 }}>
      <section className="detail-card" aria-label="Grade and 4-category ratings">
        <div className="hand" style={{ fontSize: 18, color: "var(--blue)" }}>Pin your grade</div>
        <div className="pin-row">
          {Array.from({ length: 10 }, (_, index) => {
            const n = index + 1;
            const state = score >= n ? "full" : score >= n - 0.5 ? "half" : "";
            return (
              <button key={n} type="button" aria-label={`Grade ${n}`} aria-pressed={score >= n} onClick={() => setGrade(n)}>
                <span className={`pin ${state}`} />
              </button>
            );
          })}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>Tap a pin to grade, or score the 4 categories below.</div>

        <div className="m-cork-cats">
          <CategoryRatingBlock
            gameId={game.id}
            breakdown={game.ratingBreakdown}
            onSave={saveCategories}
          />
        </div>
      </section>

      <label className="detail-card m-cork-notes">
        <span className="m-cork-label">Notes</span>
        <textarea
          placeholder="Thoughts, memories, standout moments…"
          value={notes}
          onChange={event => setNotes(event.target.value)}
          onBlur={saveNotes}
        />
      </label>

      <section className="detail-card stack" style={{ gap: 8 }} aria-label="Play it again">
        <span className="m-cork-label" style={{ margin: 0 }}>Play it again?</span>
        <div className="chips">
          {REPLAY.map(option => (
            <button
              key={option.value}
              type="button"
              className="chip"
              aria-pressed={game.replay === option.value}
              onClick={() => void save({ replay: game.replay === option.value ? null : option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const screenshotsBlock = shots.length && activeShot ? (
    <section className="m-media" aria-label="Screenshots">
      <div className="m-media__hero">
        <img
          src={screenshotSrc(activeShot.imageId, "hero")}
          alt={`${game.title} screenshot ${shotIndex + 1}`}
          onClick={() => setLightbox(true)}
          style={{ cursor: "zoom-in" }}
        />
        <span className="m-media__badge">Screenshots · {shotIndex + 1}/{shots.length}</span>
        <button type="button" className="m-media__fs" onClick={() => setLightbox(true)}>Fullscreen</button>
      </div>
      {shots.length > 1 ? (
        <div className="m-media__thumbs">
          {shots.slice(0, 10).map((shot, index) => (
            <button
              key={shot.imageId}
              type="button"
              className="m-media__thumb"
              aria-label={`Show screenshot ${index + 1}`}
              aria-pressed={index === shotIndex}
              onClick={() => setShotIndex(index)}
            >
              <img src={screenshotSrc(shot.imageId)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  ) : null;

  const extrasBlock = (
    <div className="stack" style={{ gap: 12 }}>
      {neighbours && (neighbours.before || neighbours.after) ? (
        <section className="m-neighbours" aria-label="Finished before and after">
          <NeighbourCard game={neighbours.before} label="Finished before" onOpen={openCompleted} />
          <NeighbourCard game={neighbours.after} label="Finished after" onOpen={openCompleted} />
        </section>
      ) : null}

      {game.summary ? (
        <details className="detail-card">
          <summary style={{ fontWeight: 700, minHeight: 28, cursor: "pointer" }}>About the game</summary>
          <p style={{ margin: "8px 0 0", lineHeight: 1.55, fontSize: 14 }}>{game.summary}</p>
        </details>
      ) : null}

      <div className="row">
        <button type="button" className="btn small danger detail-pill" onClick={() => void remove()}>Remove from Completed</button>
      </div>
    </div>
  );

  const screenshotsColumn = (
    <div className="stack" style={{ gap: 12 }}>
      {screenshotsBlock}
      {extrasBlock}
    </div>
  );

  return (
    <article className="detail-glass" data-tint={detailTint} style={coverTintStyle(palette)}>
      <div className="detail-topbar">
        <button type="button" className="back detail-pill" onClick={back}>‹ Completed</button>
        <div className="detail-pill detail-tint" role="group" aria-label="Cover tint strength">
          <span>Tint</span>
          {TINTS.map(value => (
            <button key={value} type="button" aria-pressed={detailTint === value} onClick={() => setDetailTint(value)}>
              {value}%
            </button>
          ))}
        </div>
      </div>

      <div className="m-cork-layout">
        {coverColumn}
        {context.wide ? (
          <>
            {middleColumn}
            {screenshotsColumn}
          </>
        ) : (
          <>
            {screenshotsBlock}
            {middleColumn}
            {extrasBlock}
          </>
        )}
      </div>

      {lightbox && activeShot ? createPortal(
        <div className="m-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" onClick={() => setLightbox(false)}>
          <img src={screenshotSrc(activeShot.imageId, "hero")} alt={`${game.title} screenshot`} onClick={event => event.stopPropagation()} />
          <div className="row">
            {shots.length > 1 ? (
              <>
                <button type="button" className="btn small" style={{ color: "#fff", borderColor: "var(--gold)" }} onClick={event => { event.stopPropagation(); setShotIndex(i => (i - 1 + shots.length) % shots.length); }}>‹ Prev</button>
                <button type="button" className="btn small" style={{ color: "#fff", borderColor: "var(--gold)" }} onClick={event => { event.stopPropagation(); setShotIndex(i => (i + 1) % shots.length); }}>Next ›</button>
              </>
            ) : null}
            <button type="button" className="btn small" style={{ color: "#fff", borderColor: "var(--gold)" }} onClick={() => setLightbox(false)}>Close</button>
          </div>
        </div>,
        document.body
      ) : null}
    </article>
  );
}

function NeighbourCard({ game, label, onOpen }: { game: CompletedGameListItem | null; label: string; onOpen: (id: string) => void }) {
  if (!game) return <div />;
  return (
    <button type="button" className="detail-card m-neighbour" onClick={() => onOpen(game.id)} aria-label={`Open ${game.title}, ${label}`}>
      {game.coverImageId ? <img src={igdbCoverSrc(game.coverImageId, "big")} alt="" loading="lazy" /> : <span className="blank" />}
      <span className="m-neighbour__text">
        <small>{label}</small>
        <strong>{game.title}</strong>
        <span className="muted">{[finishedLabel(game, false), ratingLabel(game.ratingScore, game.ratingRaw)].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  );
}
