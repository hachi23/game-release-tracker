import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { YearInReviewGame, YearInReviewPlayerType, YearInReviewShare, YearInReviewSummary, YearInReviewYear } from "../../../../../shared/types";
import { igdbCoverSrc, screenshotSrc } from "../../../../frontend/src/artwork";
import { youtubeEmbedSrc } from "../../../../frontend/src/youtube";
import type { AcademyContext } from "../AcademyApp";
import { monthName } from "../format";
import { Empty } from "../ui";

// Year in Review as the Academy Yearbook: an animated cover, then five chapters (Enrolment, Curriculum,
// Examinations, Timetable, Commencement). Each chapter change sweeps a ribbon-coloured wipe across the
// page, cards rise in, numbers count up and bars grow. Months, subjects, campuses and grades open a shelf
// of their games. A card with no data is left out, as on the desktop. The theme song player lives here,
// above the chapters, so it keeps playing while you turn pages.

const CHAPTERS = [
  { num: "I", name: "Enrolment", tab: "Enrolment", color: "var(--ribbon-1)", particle: "chalk" },
  { num: "II", name: "Curriculum", tab: "Curriculum", color: "var(--ribbon-2)", particle: "leaf" },
  { num: "III", name: "Examinations", tab: "Exams", color: "var(--ribbon-5)", particle: "spark" },
  { num: "IV", name: "Timetable", tab: "Timetable", color: "var(--ribbon-4)", particle: "star" },
  { num: "V", name: "Commencement", tab: "Finale", color: "var(--ribbon-3)", particle: "confetti" }
] as const;

const HOUSES: Record<YearInReviewPlayerType, string> = {
  critic: "The Critics",
  loyalist: "The Loyalists",
  explorer: "The Explorers",
  "time-traveller": "The Time-Travellers",
  "day-one-hero": "The Day-One Heroes",
  completionist: "The Completionists",
  adventurer: "The Adventurers"
};

const grade = (score: number | null) => (score === null ? "–" : Number.isInteger(score) ? String(score) : score.toFixed(1));
const cover = (game: YearInReviewGame) => (game.coverImageId ? igdbCoverSrc(game.coverImageId, "big") : null);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 0 → 1 over about a second, restarting whenever `key` changes (each chapter); instant with reduced motion.
function useProgress(key: unknown) {
  const [t, setT] = useState(1);
  useEffect(() => {
    if (reducedMotion()) {
      setT(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const value = Math.min(1, Math.max(0, (now - start - 450) / 1100));
      setT(value);
      if (value < 1) frame = requestAnimationFrame(step);
    };
    setT(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key]);
  return 1 - Math.pow(1 - t, 3);
}

interface Shelf {
  title: string;
  games: YearInReviewGame[];
}

export function YearView({ context }: { context: AcademyContext }) {
  const { api, fail, goTo } = context;
  const [years, setYears] = useState<YearInReviewYear[] | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [summary, setSummary] = useState<YearInReviewSummary | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [drill, setDrill] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    api.getYearInReviewYears().then(answer => {
      setYears(answer.years);
      setYear(answer.years[0]?.year ?? null);
    }).catch(fail);
  }, [api, fail]);

  useEffect(() => {
    if (year === null) return;
    setSummary(null);
    setChapter(null);
    setPlaying(false);
    api.getYearInReview(year).then(setSummary).catch(fail);
  }, [api, year, fail]);

  const turnTo = (index: number | null) => {
    setChapter(index);
    setDrill(null);
    window.scrollTo(0, 0);
  };

  const saveSettings = async (patch: Parameters<typeof api.saveYearInReviewSettings>[1]) => {
    if (year === null) return;
    try {
      setSummary(await api.saveYearInReviewSettings(year, patch));
    } catch (error) {
      fail(error);
    }
  };

  if (years?.length === 0) return <Empty action={<button type="button" className="btn solid" onClick={() => goTo("completed")}>Open Completed</button>}>Finish a game and give it a date to start your first yearbook.</Empty>;
  if (!summary || year === null) return null;
  if (summary.count === 0) return <Empty>No finished games with a date in {year} yet.</Empty>;

  const musicId = summary.goty?.musicVideoId ?? null;

  return (
    <div className="yearbook">
      {chapter === null ? (
        <YearbookCover summary={summary} years={years ?? []} onYear={setYear} onOpen={() => turnTo(0)} />
      ) : (
        <>
          <nav className="yb-tabs" aria-label="Chapters">
            {CHAPTERS.map((item, index) => (
              <button key={item.num} type="button" aria-current={index === chapter ? "page" : undefined} aria-label={`Chapter ${item.num}: ${item.name}`} style={{ ["--tab" as string]: item.color }} onClick={() => turnTo(index)}>
                <b>{item.num}</b>
                <span>{item.tab}</span>
              </button>
            ))}
          </nav>

          <section className="yb-page" aria-live="polite" aria-label={`Chapter ${CHAPTERS[chapter].num}: ${CHAPTERS[chapter].name}`}>
            <Particles kind={CHAPTERS[chapter].particle} key={`p${chapter}`} />
            <div className="yb-scroll">
              <ChapterBody key={chapter} index={chapter} summary={summary} drill={drill} setDrill={setDrill} saveSettings={saveSettings} playing={playing} setPlaying={setPlaying} />
            </div>
          </section>

          <nav className="yb-turn" aria-label="Turn the page">
            <button type="button" className="btn" onClick={() => turnTo(chapter === 0 ? null : chapter - 1)}>{chapter === 0 ? "Cover" : "Back"}</button>
            <button type="button" className="btn yb-next" onClick={() => turnTo(chapter < CHAPTERS.length - 1 ? chapter + 1 : null)}>
              {chapter < CHAPTERS.length - 1 ? `Next: ${CHAPTERS[chapter + 1].name}` : "Back to the cover"}
            </button>
          </nav>
        </>
      )}

      {playing && musicId ? (
        <div className="yb-player" role="region" aria-label="Theme song">
          <iframe title="Theme song" src={youtubeEmbedSrc(musicId)} allow="autoplay; encrypted-media" />
          <button type="button" className="btn small" onClick={() => setPlaying(false)}>Stop</button>
        </div>
      ) : null}
    </div>
  );
}

function YearbookCover({ summary, years, onYear, onOpen }: { summary: YearInReviewSummary; years: YearInReviewYear[]; onYear: (year: number) => void; onOpen: () => void }) {
  return (
    <section className="yb-cover" aria-label={`Yearbook for ${summary.year}`} key={summary.year}>
      <svg className="yb-a yb-stamp" width="96" height="114" viewBox="0 0 30 36" aria-hidden="true" style={{ animationDelay: ".2s" }}>
        <path d="M15 1 L29 6 V17 C29 26 22 32 15 35 C8 32 1 26 1 17 V6 Z" fill="none" stroke="var(--gold)" strokeWidth="1.1" />
        <path d="M9 12 H21 M9 17 H21 M9 22 H17" stroke="var(--gold)" strokeWidth="1.1" />
      </svg>
      <span className="yb-a yb-rise yb-kicker" style={{ animationDelay: ".9s" }}>The Academy Yearbook</span>
      <h1 aria-label={`Class of ${summary.year}`}>
        <span aria-hidden="true" className="yb-letters">
          {"Class of".split("").map((letter, index) => <span key={index} className="yb-a yb-letter" style={{ animationDelay: `${1.1 + index * 0.07}s` }}>{letter}</span>)}
        </span>
        <span aria-hidden="true" className="yb-a yb-stamp yb-year" style={{ animationDelay: "1.9s" }}>{summary.year}</span>
        <i aria-hidden="true" className="yb-a yb-foil" />
      </h1>
      <span className="yb-a yb-rise hand" style={{ animationDelay: "2.6s", fontSize: 26, color: "var(--gold)" }}>
        {summary.count === 1 ? "1 game" : `${summary.count} games`}{summary.inProgress ? " so far" : ""} · five chapters
      </span>
      {years.length > 1 ? (
        <div className="yb-a yb-rise chips" style={{ animationDelay: "2.8s", justifyContent: "center" }}>
          {years.map(entry => (
            <button key={entry.year} type="button" className="chip" aria-pressed={entry.year === summary.year} onClick={() => onYear(entry.year)}>{entry.year}</button>
          ))}
        </div>
      ) : null}
      <button type="button" className="yb-a yb-rise btn yb-open" style={{ animationDelay: "3s" }} onClick={onOpen}>Open the yearbook</button>
    </section>
  );
}

function Particles({ kind }: { kind: string }) {
  return (
    <div className={`yb-particles yb-${kind}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <i key={index} style={{ left: `${(index * 37 + kind.length * 11) % 100}%`, top: kind === "star" ? `${(index * 53) % 95}%` : undefined, width: 3 + (index % 3) * 2, height: 3 + (index % 3) * 2, animationDuration: `${(kind === "star" ? 3 : 7) + (index % 5)}s`, animationDelay: `${-(index * 1.3)}s` }} />
      ))}
    </div>
  );
}

function ChapterBody({ index, summary, drill, setDrill, saveSettings, playing, setPlaying }: {
  index: number;
  summary: YearInReviewSummary;
  drill: string | null;
  setDrill: (key: string | null) => void;
  saveSettings: (patch: { gotyCompletedId?: string | null; musicLink?: string | null }) => Promise<void>;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
}) {
  const ease = useProgress(index);
  const up = (value: number, decimals = 0) => (value * ease).toFixed(decimals);
  const byId = useMemo(() => new Map(summary.games.map(game => [game.id, game])), [summary]);
  const gamesOf = (ids: string[]) => ids.map(id => byId.get(id)).filter((game): game is YearInReviewGame => Boolean(game));
  const toggle = (key: string) => setDrill(drill === key ? null : key);
  const chapter = CHAPTERS[index];

  const perMonth = summary.overview.months.map((_, month) => summary.games.filter(game => game.month === month + 1));
  const graded = Array.from({ length: 11 }, (_, value) => summary.games.filter(game => game.ratingScore !== null && Math.floor(game.ratingScore + 0.5) === value));

  const shelfFor = (key: string): Shelf | null => {
    const kind = key[0];
    const rest = key.slice(1);
    if (kind === "m") return { title: `${monthName(Number(rest) + 1)}: ${perMonth[Number(rest)].length} finished`, games: perMonth[Number(rest)] };
    if (kind === "r") return { title: `Graded ${rest}: ${graded[Number(rest)].length} games`, games: graded[Number(rest)] };
    const lists: Record<string, YearInReviewShare[]> = { g: summary.taste.genres, t: summary.taste.themes, p: summary.taste.platforms };
    const share = lists[kind]?.[Number(rest)];
    return share ? { title: `${kind === "p" ? "On " : ""}${share.name}: ${share.count} games`, games: gamesOf(share.ids) } : null;
  };
  const shelf = drill ? shelfFor(drill) : null;

  const band = (title: string, lead: string) => (
    <header key="band" className="yb-band yb-rise" style={{ background: chapter.color, animationDelay: ".35s" }}>
      <div className="yb-band-kicker">Chapter {chapter.num} · {chapter.name}</div>
      <h2>{title}</h2>
      <p>{lead}</p>
    </header>
  );

  const body: ReactNode[] = [];
  let delay = 0.5;
  const card = (key: string, node: ReactNode) => {
    body.push(<div key={key} className="yb-rise" style={{ animationDelay: `${delay.toFixed(2)}s` }}>{node}</div>);
    delay += 0.12;
  };
  const shelfNode = shelf ? <ShelfView key={`shelf-${drill}`} shelf={shelf} /> : null;

  if (index === 0) {
    const { overview } = summary;
    body.push(band(`The Class of ${summary.year}`, "Who turned up, and when. Tap a month to open its register."));
    card("count", (
      <div className="row" style={{ alignItems: "baseline", flexWrap: "nowrap" }}>
        <span className="display" style={{ fontWeight: 800, fontSize: 92, lineHeight: 0.9 }}>{up(summary.count)}</span>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{summary.count === 1 ? "game finished" : "games finished"}{summary.inProgress ? " so far" : ""}</span>
      </div>
    ));
    if (summary.previousYearCount !== null) card("previous", <p className="hand" style={{ margin: 0, fontSize: 22, color: "var(--red)" }}>{summary.count >= summary.previousYearCount ? "Up" : "Down"} from {summary.previousYearCount} the year before.</p>);
    card("stats", (
      <div className="yb-stats">
        {overview.averageRating !== null ? <div className="stat"><b>{up(overview.averageRating, 1)}</b><span>average grade</span></div> : null}
        <div className="stat"><b>{up(overview.nineOrHigher)}</b><span>graded 9 or more</span></div>
        {overview.busiestMonth ? <div className="stat"><b>{monthName(overview.busiestMonth.month).slice(0, 3)}</b><span>busiest, with {overview.busiestMonth.count}</span></div> : null}
      </div>
    ));
    const most = Math.max(1, ...overview.months);
    card("register", (
      <>
        <h3 className="hand yb-h3">The register</h3>
        <div className="yb-bars">
          {overview.months.map((count, month) => (
            <button key={month} type="button" aria-pressed={drill === `m${month}`} aria-label={`${monthName(month + 1)}: ${count} games`} onClick={() => toggle(`m${month}`)} disabled={count === 0}>
              <span className="hand">{count}</span>
              <i className="yb-grow" style={{ height: Math.round((count / most) * 112) + 3, background: drill === `m${month}` ? "var(--red)" : overview.busiestMonth?.month === month + 1 ? chapter.color : "var(--blue)", animationDelay: `${0.9 + month * 0.05}s` }} />
            </button>
          ))}
        </div>
        <div className="yb-axis">{overview.months.map((_, month) => <span key={month}>{monthName(month + 1)[0]}</span>)}</div>
        {summary.coverage.withMonth < summary.count ? <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>{summary.count - summary.coverage.withMonth} games have a year but no month, so they aren't on the register.</p> : null}
      </>
    ));
    if (drill?.startsWith("m")) body.push(shelfNode);
    if (overview.first && overview.last) {
      card("firstlast", (
        <>
          <h3 className="hand yb-h3">First day and last day</h3>
          <div className="row" style={{ justifyContent: "space-around", flexWrap: "nowrap" }}>
            <Snapshot game={overview.first} caption={`${overview.first.title}, ${overview.first.finishLabel}`} tilt={-4} />
            {overview.last.id !== overview.first.id ? <Snapshot game={overview.last} caption={`${overview.last.title}, ${overview.last.finishLabel}`} tilt={3} /> : null}
          </div>
        </>
      ));
    }
  }

  if (index === 1) {
    const { taste } = summary;
    body.push(band("What you studied", "Pull a book from the shelf to see the games bound inside."));
    if (taste.genres.length) card("genres", <BookShelf title="Subjects on the shelf" shares={taste.genres.slice(0, 6)} prefix="g" drill={drill} toggle={toggle} />);
    if (drill?.startsWith("g")) body.push(shelfNode);
    if (taste.themes.length) card("themes", <BookShelf title="Themes" shares={taste.themes.slice(0, 6)} prefix="t" drill={drill} toggle={toggle} />);
    if (drill?.startsWith("t")) body.push(shelfNode);
    if (taste.platforms.length) {
      const most = taste.platforms[0].count;
      card("platforms", (
        <>
          <h3 className="hand yb-h3">Campuses</h3>
          <div className="stack" style={{ gap: 8 }}>
            {taste.platforms.map((share, i) => (
              <button key={share.name} type="button" className="yb-meter" aria-pressed={drill === `p${i}`} onClick={() => toggle(`p${i}`)}>
                <span>{share.name}</span>
                <span className="yb-track"><i className="yb-growx" style={{ width: `${(share.count / most) * 100}%`, background: drill === `p${i}` ? "var(--red)" : chapter.color, animationDelay: `${0.8 + i * 0.08}s` }} /></span>
                <span className="hand">{share.count}</span>
              </button>
            ))}
          </div>
        </>
      ));
    }
    if (drill?.startsWith("p")) body.push(shelfNode);
    if (taste.publisher || taste.developer) {
      card("favourites", (
        <div className="yb-pair">
          {taste.publisher ? <Fact label="Favourite publisher" title={taste.publisher.name} note={`${taste.publisher.count} games`} /> : null}
          {taste.developer ? <Fact label="Favourite studio" title={taste.developer.name} note={`${taste.developer.count} games`} /> : null}
        </div>
      ));
    }
    if (taste.playModes) card("modes", <Fact label="Solo or together" title={`${taste.playModes.solo} solo · ${taste.playModes.together} with others`} note={taste.playModes.solo >= taste.playModes.together ? "Mostly a solo scholar" : "Mostly a study group"} />);
    if (taste.somethingNew && (taste.somethingNew.genres.length || taste.somethingNew.platforms.length)) {
      card("new", <p className="sticky" style={{ margin: 0 }}>Something new this year: {[...taste.somethingNew.genres, ...taste.somethingNew.platforms].join(", ")}.</p>);
    }
  }

  if (index === 2) {
    const { ratings } = summary;
    body.push(band("How you marked them", "Tap a grade to see every paper that earned it."));
    if (ratings.playerType) {
      card("house", (
        <div className="yb-house">
          <svg className="yb-a yb-stamp" width="64" height="76" viewBox="0 0 30 36" aria-hidden="true" style={{ animationDelay: ".7s", flex: "none" }}>
            <path d="M15 1 L29 6 V17 C29 26 22 32 15 35 C8 32 1 26 1 17 V6 Z" fill={chapter.color} stroke="var(--gold)" strokeWidth="1.4" />
            <circle cx="15" cy="16" r="6" fill="none" stroke="var(--gold)" strokeWidth="1.4" />
          </svg>
          <div>
            <div className="yb-house-kicker">Your house</div>
            <div className="display" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.05 }}>{HOUSES[ratings.playerType.key]}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{ratings.playerType.reason}.</div>
          </div>
        </div>
      ));
    }
    if (ratings.spread) {
      const shown = ratings.spread.map((count, value) => ({ count, value })).filter((entry, _, all) => entry.value >= Math.min(...all.filter(e => e.count).map(e => e.value)));
      const most = Math.max(1, ...ratings.spread);
      card("spread", (
        <>
          <h3 className="hand yb-h3">The marking sheet</h3>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>Grades rounded to the nearest whole number, so a 9.5 counts as a 10.</p>
          <div className="yb-bars wide">
            {shown.map(({ count, value }, i) => (
              <button key={value} type="button" aria-pressed={drill === `r${value}`} aria-label={`Grade ${value}: ${count} games`} onClick={() => toggle(`r${value}`)} disabled={count === 0}>
                <span className="hand">{count}</span>
                <i className="yb-grow" style={{ height: Math.round((count / most) * 118) + 3, background: drill === `r${value}` ? "var(--red)" : chapter.color, animationDelay: `${0.8 + i * 0.06}s` }} />
              </button>
            ))}
          </div>
          <div className="yb-axis wide">{shown.map(({ value }) => <span key={value} className="display" style={{ fontWeight: 800 }}>{value}</span>)}</div>
        </>
      ));
    }
    if (drill?.startsWith("r")) body.push(shelfNode);
    if (ratings.hotTake) card("hot", <GameNote game={ratings.hotTake.game} kicker="Hot take" line={`You gave it ${grade(ratings.hotTake.rating)}; critics gave it ${Math.round(ratings.hotTake.criticScore)}.`} />);
    if (ratings.hiddenGem) card("gem", <GameNote game={ratings.hiddenGem.game} kicker="Hidden gem" line={ratings.hiddenGem.ratingCount === 0 ? `Your ${grade(ratings.hiddenGem.game.ratingScore)}, and nobody on IGDB has rated it yet.` : `Your ${grade(ratings.hiddenGem.game.ratingScore)}, with only ${ratings.hiddenGem.ratingCount} ratings on IGDB.`} sticky />);
    if (ratings.criticsAgreed) card("critics", <Fact label="Critics agreed" title={`${ratings.criticsAgreed.agreed} of ${ratings.criticsAgreed.total}`} note="games where your grade was close to the critics'" />);
  }

  if (index === 3) {
    const { timing, overview } = summary;
    body.push(band("When you played", "The hand points at your busiest month. Tap any hour on the clock."));
    const pointed = drill?.startsWith("m") ? Number(drill.slice(1)) : (overview.busiestMonth?.month ?? 1) - 1;
    card("dial", (
      <div className="yb-dial">
        <div className="yb-dial-face" />
        <div className="yb-dial-hand" style={{ transform: `rotate(${pointed * 30}deg)` }} />
        <i className="yb-dial-pin" />
        {overview.months.map((count, month) => {
          const angle = (month / 12) * Math.PI * 2 - Math.PI / 2;
          return (
            <button key={month} type="button" aria-pressed={drill === `m${month}`} aria-label={`${monthName(month + 1)}: ${count} games`} disabled={count === 0}
              style={{ left: 140 + Math.cos(angle) * 118, top: 140 + Math.sin(angle) * 118, background: drill === `m${month}` ? "var(--red)" : overview.busiestMonth?.month === month + 1 ? chapter.color : "var(--page)", color: drill === `m${month}` || overview.busiestMonth?.month === month + 1 ? "var(--ribbon-text)" : "var(--ink)" }}
              onClick={() => toggle(`m${month}`)}>
              <span>{monthName(month + 1).slice(0, 3)}</span>
              <b className="hand">{count}</b>
            </button>
          );
        })}
      </div>
    ));
    if (drill?.startsWith("m")) body.push(shelfNode);
    if (timing.longestStreak) card("streak", <Fact label="Longest streak" title={`${up(timing.longestStreak.months)} months in a row`} note={`${monthName(timing.longestStreak.from)} to ${monthName(timing.longestStreak.to)}`} big={chapter.color} />);
    if (timing.dayOne?.games.length) card("dayone", <Fact label="Day-one finishes" title={timing.dayOne.games.map(game => game.title).join(", ")} note="Finished the week they came out" />);
    if (timing.lateToTheParty) card("late", <GameNote game={timing.lateToTheParty.game} kicker="Late to the party" line={`${up(timing.lateToTheParty.years)} years after it came out in ${timing.lateToTheParty.releaseYear}.`} />);
    if (timing.releaseRange) {
      const { oldest, newest } = timing.releaseRange;
      card("range", (
        <div className="sheet">
          <div className="yb-label">Oldest and newest</div>
          <div className="yb-range"><i className="yb-growx" style={{ background: chapter.color, animationDelay: "1s" }} /><b /><b /></div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", fontSize: 13 }}>
            <span><b>{oldest.year}</b><br />{oldest.game.title}</span>
            <span style={{ textAlign: "right" }}><b>{newest.year}</b><br />{newest.game.title}</span>
          </div>
        </div>
      ));
    }
  }

  if (index === 4) {
    return <Commencement summary={summary} saveSettings={saveSettings} playing={playing} setPlaying={setPlaying} />;
  }

  return (
    <div className="stack yb-chapter" style={{ gap: 16 }}>
      <i className="yb-wipe" aria-hidden="true" style={{ background: chapter.color }} />
      {body}
    </div>
  );
}

function Commencement({ summary, saveSettings, playing, setPlaying }: {
  summary: YearInReviewSummary;
  saveSettings: (patch: { gotyCompletedId?: string | null; musicLink?: string | null }) => Promise<void>;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [link, setLink] = useState("");
  const goty = summary.goty;
  const backdrop = goty?.backdrop ? (goty.backdrop.kind === "screenshot" ? screenshotSrc(goty.backdrop.imageId, "hero") : igdbCoverSrc(goty.backdrop.imageId, "detail")) : null;

  return (
    <div className="stack yb-chapter" style={{ gap: 16, margin: "0 -18px" }}>
      <i className="yb-wipe" aria-hidden="true" style={{ background: CHAPTERS[4].color }} />
      {goty ? (
        <div className="yb-throne">
          {backdrop ? <img className="yb-backdrop" src={backdrop} alt="" style={{ filter: goty.backdrop?.kind === "cover" ? "blur(14px) saturate(1.2)" : undefined }} /> : null}
          <span className="yb-rise yb-kicker" style={{ animationDelay: ".4s" }}>Chapter V · Commencement</span>
          <span className="yb-rise display" style={{ animationDelay: ".55s", fontStyle: "italic", fontSize: 22 }}>This year's valedictorian</span>
          {cover(goty.game) ? <img className="yb-a yb-reveal" src={cover(goty.game)!} alt={`${goty.game.title} cover`} /> : null}
          <h2 className="yb-rise" style={{ animationDelay: "1.4s" }}>{goty.game.title}</h2>
          <div className="yb-rise row" style={{ animationDelay: "1.55s", flexWrap: "nowrap", justifyContent: "center" }}>
            <span className="yb-medal">{grade(goty.game.ratingScore)}</span>
            <span className="hand" style={{ fontSize: 21, lineHeight: 1.2, color: "var(--gold)", textAlign: "left" }}>
              {goty.isOverride ? `Your own pick, finished ${goty.game.finishLabel}` : goty.isLatestFinish ? `Your last finish of the year, ${goty.game.finishLabel}` : `Your highest grade, finished ${goty.game.finishLabel}`}
            </span>
          </div>
          {goty.note ? <p className="yb-rise" style={{ animationDelay: "1.65s", margin: 0, maxWidth: 300 }}>{goty.note}</p> : null}
          <div className="yb-rise row" style={{ animationDelay: "1.7s", justifyContent: "center" }}>
            <button type="button" className="btn small yb-ghost" aria-expanded={picking} onClick={() => setPicking(value => !value)}>Choose my Game of the Year</button>
            {goty.isOverride ? <button type="button" className="btn small yb-gold" onClick={() => void saveSettings({ gotyCompletedId: null })}>Use automatic pick</button> : null}
          </div>
        </div>
      ) : null}

      {picking ? (
        <div className="yb-a yb-shelf-open" style={{ padding: "0 18px" }}>
          <h3 className="hand yb-h3">Choose from your {summary.count}</h3>
          <div className="yb-picker">
            {summary.games.map(game => (
              <button key={game.id} type="button" aria-label={game.title} aria-pressed={goty?.game.id === game.id} onClick={() => { setPicking(false); void saveSettings({ gotyCompletedId: game.id }); }}>
                {cover(game) ? <img src={cover(game)!} alt="" /> : <span className="blank">{game.title}</span>}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="yb-rise sheet stack" style={{ animationDelay: "1.85s", margin: "0 18px", gap: 8 }}>
        <span className="display" style={{ fontWeight: 800, fontSize: 17 }}>Theme for the ceremony</span>
        {goty?.musicVideoId ? (
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <button type="button" className="btn small solid" onClick={() => setPlaying(!playing)}>{playing ? "Pause the theme" : "Play the theme"}</button>
            <button type="button" className="btn small" onClick={() => { setPlaying(false); void saveSettings({ musicLink: null }); }}>Remove</button>
          </div>
        ) : (
          <form className="search" onSubmit={event => { event.preventDefault(); if (link.trim()) void saveSettings({ musicLink: link.trim() }).then(() => setLink("")); }}>
            <label className="sr-only" htmlFor="theme-link">YouTube link for the theme music</label>
            <input id="theme-link" className="input" type="url" placeholder="Paste a YouTube link…" value={link} onChange={event => setLink(event.target.value)} />
            <button type="submit" className="btn solid">Save</button>
          </form>
        )}
        <span className="muted" style={{ fontSize: 12 }}>It keeps playing while you turn the pages.</span>
      </div>

      <div className="yb-rise" style={{ animationDelay: "2s", padding: "0 18px 8px" }}>
        <h3 className="hand yb-h3">The rest of your class</h3>
        <div className="yb-shelf">
          {summary.games.filter(game => game.id !== goty?.game.id).map(game => (
            <figure key={game.id} style={{ width: 74 }}>
              {cover(game) ? <img src={cover(game)!} alt="" /> : <span className="blank" />}
              <figcaption>{game.title}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShelfView({ shelf }: { shelf: Shelf }) {
  return (
    <div className="yb-a yb-shelf-open">
      <h4 className="display" style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 16 }}>{shelf.title}</h4>
      <div className="yb-shelf">
        {shelf.games.map(game => (
          <figure key={game.id}>
            {cover(game) ? <img src={cover(game)!} alt="" /> : <span className="blank" />}
            <figcaption>{game.title}<br /><span className="hand" style={{ color: "var(--red)", fontSize: 15 }}>{grade(game.ratingScore)}</span> <span className="muted">{game.finishLabel}</span></figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function BookShelf({ title, shares, prefix, drill, toggle }: { title: string; shares: YearInReviewShare[]; prefix: string; drill: string | null; toggle: (key: string) => void }) {
  const most = shares[0]?.count ?? 1;
  const colors = ["var(--ribbon-2)", "var(--ribbon-1)", "var(--ribbon-5)", "var(--ribbon-4)", "var(--ribbon-3)", "var(--ribbon-6)"];
  return (
    <>
      <h3 className="hand yb-h3">{title}</h3>
      <div className="yb-books">
        {shares.map((share, i) => (
          <button key={share.name} type="button" className="yb-grow" aria-pressed={drill === `${prefix}${i}`} aria-label={`${share.name}: ${share.count} games`} onClick={() => toggle(`${prefix}${i}`)}
            style={{ height: Math.round(60 + (share.count / most) * 120), background: colors[i % colors.length], animationDelay: `${0.6 + i * 0.08}s` }}>
            <b>{share.count}</b>
            <span>{share.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Snapshot({ game, caption, tilt }: { game: YearInReviewGame; caption: string; tilt: number }) {
  return (
    <figure className="polaroid" style={{ width: 132, margin: 0, transform: `rotate(${tilt}deg)`, paddingBottom: 38 }}>
      {cover(game) ? <img src={cover(game)!} alt={`${game.title} cover`} /> : <div className="blank" />}
      <figcaption className="caption" style={{ whiteSpace: "normal", fontSize: 15, lineHeight: 1 }}>{caption}</figcaption>
    </figure>
  );
}

function Fact({ label, title, note, big }: { label: string; title: string; note?: string; big?: string }) {
  return (
    <div className="sheet">
      <div className="yb-label">{label}</div>
      <div className="display" style={{ marginTop: 4, fontWeight: 800, fontSize: big ? 30 : 17, lineHeight: 1.15, color: big }}>{title}</div>
      {note ? <div className="hand" style={{ fontSize: 18, color: "var(--red)" }}>{note}</div> : null}
    </div>
  );
}

function GameNote({ game, kicker, line, sticky = false }: { game: YearInReviewGame; kicker: string; line: string; sticky?: boolean }) {
  return (
    <div className={sticky ? "sticky row" : "sheet row"} style={{ flexWrap: "nowrap", gap: 14, fontFamily: "inherit", fontWeight: 400, fontSize: 15 }}>
      {cover(game) ? <img src={cover(game)!} alt="" style={{ flex: "none", width: 62, aspectRatio: "3 / 4", objectFit: "cover", border: "3px solid var(--polaroid)" }} /> : null}
      <div>
        <div className="yb-label">{kicker}</div>
        <div className="display" style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.15 }}>{game.title}</div>
        <div style={{ fontSize: 13 }}>{line}</div>
      </div>
    </div>
  );
}
