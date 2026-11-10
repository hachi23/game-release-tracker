import { useEffect, useMemo, useState } from "react";
import type { CompletedGameDetail, CompletedGameListItem } from "../../../../../shared/types";
import { igdbCoverSrc, screenshotSrc } from "../../../../frontend/src/artwork";
import type { AcademyContext } from "../AcademyApp";
import { parseDay, ratingLabel } from "../format";

// A finished game's page: the Dorm Corkboard. The cover is pinned up with a red grade tag; ten pushpins
// set the grade (tap again for the half point); sticky notes hold the one-line verdict and notes; the
// favourite moment is a pinned photo picked from the game's screenshots; red string runs to the games
// finished just before and after it. Taps save at once; typed text saves when you leave the field.

type Replay = NonNullable<CompletedGameDetail["replay"]>;
const REPLAY: Array<{ value: Replay; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" }
];

const ordinal = (n: number) => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

const finishedLabel = (game: Pick<CompletedGameListItem, "completionDate" | "completionMonth" | "completionYear">, withYear = true) => {
  const day = parseDay(game.completionDate);
  if (day) return day.toLocaleDateString(undefined, withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  return game.completionMonth ?? (game.completionYear ? String(game.completionYear) : null);
};

// Finish order: dated games by date, then month-only, then year-only, then undated.
const sortKey = (game: CompletedGameListItem) => game.completionDate ?? (game.completionMonth ? `${game.completionMonth}-99` : game.completionYear ? `${game.completionYear}-99-99` : "9999");

export function CompletedDetailView({ id, context }: { id: string; context: AcademyContext }) {
  const { api, fail, back, openCompleted } = context;
  const [game, setGame] = useState<CompletedGameDetail | null>(null);
  const [library, setLibrary] = useState<CompletedGameListItem[]>([]);
  const [draft, setDraft] = useState({ verdict: "", favouriteCaption: "", notes: "" });

  useEffect(() => {
    api.getCompletedGame(id).then(item => {
      setGame(item);
      setDraft({ verdict: item.verdict ?? "", favouriteCaption: item.favouriteCaption ?? "", notes: item.notes ?? "" });
    }).catch(fail);
    api.listCompletedGames().then(answer => setLibrary(answer.items)).catch(() => undefined);
  }, [api, id, fail]);

  const save = async (patch: Record<string, unknown>) => {
    try {
      const { item } = await api.patchCompletedGame(id, patch);
      setGame(item);
      setLibrary(current => current.map(entry => (entry.id === item.id ? { ...entry, ...item } : entry)));
    } catch (error) {
      fail(error);
    }
  };
  const saveText = (key: keyof typeof draft) => {
    if (!game || (game[key] ?? "") === draft[key]) return;
    void save({ [key]: draft[key] });
  };

  const placing = useMemo(() => {
    if (!game?.completionYear) return null;
    const year = library.filter(entry => entry.completionYear === game.completionYear);
    if (!year.some(entry => entry.id === game.id)) return null;
    const inOrder = [...year].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const index = inOrder.findIndex(entry => entry.id === game.id);
    const graded = year.filter(entry => entry.ratingScore !== null && entry.ratingScore !== undefined);
    const score = game.ratingScore;
    const better = score === null || score === undefined ? null : graded.filter(entry => (entry.ratingScore ?? 0) > score).length;
    const tied = score === null || score === undefined ? 0 : graded.filter(entry => entry.ratingScore === score).length;
    return {
      year: game.completionYear,
      total: year.length,
      finishNumber: game.completionDate ? index + 1 : null,
      rank: better === null ? null : better + 1,
      tied: tied > 1,
      onlyTop: better === 0 && tied === 1,
      before: index > 0 ? inOrder[index - 1] : null,
      after: index >= 0 && index < inOrder.length - 1 ? inOrder[index + 1] : null
    };
  }, [game, library]);

  const remove = async () => {
    if (!window.confirm(`Take ${game?.title} off your Completed Library?`)) return;
    try {
      await api.deleteCompletedGame(id);
      back();
    } catch (error) {
      fail(error);
    }
  };

  if (!game) return null;
  const score = game.ratingScore ?? 0;
  const grade = ratingLabel(game.ratingScore, game.ratingRaw);
  const setGrade = (n: number) => void save({ ratingRaw: String(score === n ? n - 0.5 : n) });
  const finished = finishedLabel(game);
  const shots = game.screenshots;
  const moment = shots.find(shot => shot.imageId === game.favouriteShot) ?? null;
  const studio = game.igdbDeveloper ?? game.developer;
  const publisher = game.igdbPublisher ?? game.publisher;
  const genres = game.igdbGenres.length ? game.igdbGenres : game.genres;

  return (
    <article className="corkboard-page">
      <button type="button" className="back" onClick={back} style={{ alignSelf: "flex-start" }}>‹ Completed</button>

      <div className="corkboard">
        <div className="cork-top">
          <figure className="cork-photo" style={{ transform: "rotate(-3deg)" }}>
            {game.coverImageId ? <img src={igdbCoverSrc(game.coverImageId, "detail")} alt={`${game.title} cover`} /> : <div className="blank" aria-hidden="true" />}
            <span className="pushpin" aria-hidden="true" />
            {finished ? <figcaption>done! {finished}</figcaption> : null}
          </figure>
          <div className="stack" style={{ gap: 12, paddingTop: 8, minWidth: 0 }}>
            <div className="cork-card" style={{ transform: "rotate(2deg)" }}>
              <h1>{game.title}</h1>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{[game.userPlatform, studio].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="grade-tag" style={{ transform: "rotate(-2deg)" }}>
              <div className="grade-tag-label">My grade</div>
              <div className="grade-tag-value">{grade}</div>
              {placing?.onlyTop ? <div className="grade-tag-note">top of {placing.year}</div> : null}
            </div>
          </div>
        </div>

        <section className="cork-card" aria-label="Your grade in pins" style={{ transform: "rotate(-.6deg)" }}>
          <div className="hand" style={{ fontSize: 21, color: "var(--blue)" }}>Pin your grade</div>
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
          <div className="muted" style={{ fontSize: 12 }}>Tap a pin. Tap it again for the half point.</div>
        </section>

        <label className="cork-sticky" style={{ transform: "rotate(1.4deg)" }}>
          <span className="cork-label">In one line</span>
          <input type="text" maxLength={200} placeholder="Sum it up for future you…" value={draft.verdict} onChange={event => setDraft({ ...draft, verdict: event.target.value })} onBlur={() => saveText("verdict")} />
        </label>

        {shots.length ? (
          <section className="stack" aria-label="Favourite moment" style={{ gap: 10 }}>
            <figure className="cork-photo wide" style={{ transform: "rotate(-1.2deg)" }}>
              {moment ? <img src={screenshotSrc(moment.imageId, "hero")} alt="Your favourite moment" /> : <div className="blank cork-empty">Pin a favourite moment from below</div>}
              <span className="pushpin blue" aria-hidden="true" />
              <figcaption>
                <label className="sr-only" htmlFor="moment-caption">Caption</label>
                <input id="moment-caption" type="text" maxLength={200} placeholder="favourite moment" value={draft.favouriteCaption} onChange={event => setDraft({ ...draft, favouriteCaption: event.target.value })} onBlur={() => saveText("favouriteCaption")} />
              </figcaption>
            </figure>
            <div className="cork-thumbs">
              {shots.slice(0, 6).map((shot, index) => (
                <button key={shot.imageId} type="button" aria-label={`Pin screenshot ${index + 1}`} aria-pressed={shot.imageId === game.favouriteShot} onClick={() => void save({ favouriteShot: shot.imageId === game.favouriteShot ? null : shot.imageId })}>
                  <img src={screenshotSrc(shot.imageId)} alt="" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="row cork-replay" aria-label="Play it again">
          <span className="cork-sticky small" style={{ transform: "rotate(-2deg)" }}>Play it again?</span>
          {REPLAY.map((option, index) => (
            <button key={option.value} type="button" aria-pressed={game.replay === option.value} style={{ transform: `rotate(${[-3, 2, -1][index]}deg)` }} onClick={() => void save({ replay: game.replay === option.value ? null : option.value })}>
              {option.label}
            </button>
          ))}
        </section>

        {placing && (placing.before || placing.after) ? (
          <section aria-label="Finished around it" className="cork-string">
            <svg viewBox="0 0 358 40" aria-hidden="true">
              <path d="M40 30 Q110 4 179 14 Q248 4 318 30" fill="none" stroke="var(--string)" strokeWidth="2" />
              <circle cx="40" cy="30" r="5" fill="var(--string)" />
              <circle cx="179" cy="14" r="5" fill="var(--string)" />
              <circle cx="318" cy="30" r="5" fill="var(--string)" />
            </svg>
            <div className="cork-neighbours">
              <Neighbour game={placing.before} label="before" tilt={-3} onOpen={openCompleted} />
              <div className="cork-sticky small" style={{ transform: "rotate(1deg)", textAlign: "center" }}>
                {placing.finishNumber ? `your ${ordinal(placing.finishNumber)} finish of ${placing.year}` : `one of ${placing.total} in ${placing.year}`}
                {placing.rank ? <><br />{placing.tied ? "joint " : ""}{ordinal(placing.rank)} by grade</> : null}
              </div>
              <Neighbour game={placing.after} label="after" tilt={3} onOpen={openCompleted} />
            </div>
          </section>
        ) : null}

        <label className="cork-card lined" style={{ transform: "rotate(-.8deg)" }}>
          <span className="cork-label muted">Notes</span>
          <textarea placeholder="Anything else…" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} onBlur={() => saveText("notes")} />
        </label>

        {publisher || genres.length ? (
          <div className="cork-card small" style={{ alignSelf: "flex-start", transform: "rotate(1deg)" }}>{[publisher, genres.join(", ")].filter(Boolean).join(" · ")}</div>
        ) : null}

        {game.summary ? (
          <details className="cork-card" style={{ transform: "rotate(.4deg)" }}>
            <summary style={{ fontWeight: 700, minHeight: 28, cursor: "pointer" }}>About the game</summary>
            <p style={{ margin: "8px 0 0", lineHeight: 1.55, fontSize: 14 }}>{game.summary}</p>
          </details>
        ) : null}

        <button type="button" className="btn cork-remove" onClick={() => void remove()}>Take it down</button>
      </div>
    </article>
  );
}

function Neighbour({ game, label, tilt, onOpen }: { game: CompletedGameListItem | null; label: string; tilt: number; onOpen: (id: string) => void }) {
  if (!game) return <div />;
  return (
    <button type="button" className="cork-card neighbour" style={{ transform: `rotate(${tilt}deg)` }} onClick={() => onOpen(game.id)} aria-label={`Open ${game.title}, finished ${label}`}>
      {game.coverImageId ? <img src={igdbCoverSrc(game.coverImageId, "big")} alt="" /> : <span className="blank" />}
      <span>{label}: {game.title}<br /><b>{[finishedLabel(game, false), ratingLabel(game.ratingScore, game.ratingRaw)].filter(Boolean).join(" · ")}</b></span>
    </button>
  );
}
