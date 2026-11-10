import { useEffect, useState } from "react";
import type { YearInReviewSummary, YearInReviewYear } from "../../../../../shared/types";
import { igdbCoverSrc } from "../../../../frontend/src/artwork";
import type { AcademyContext } from "../AcademyApp";
import { Empty, Polaroid } from "../ui";

// Year in Review as a report card. A working page for now: the full Academy Year in Review is chosen
// from the concept artifacts.

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const PLACES = ["1st", "2nd", "3rd"];

export function YearView({ context }: { context: AcademyContext }) {
  const { api, fail, goTo } = context;
  const [years, setYears] = useState<YearInReviewYear[] | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [summary, setSummary] = useState<YearInReviewSummary | null>(null);

  useEffect(() => {
    api.getYearInReviewYears().then(answer => {
      setYears(answer.years);
      setYear(answer.years[0]?.year ?? null);
    }).catch(fail);
  }, [api, fail]);

  useEffect(() => {
    if (year === null) return;
    setSummary(null);
    api.getYearInReview(year).then(setSummary).catch(fail);
  }, [api, year, fail]);

  if (years?.length === 0) return <Empty action={<button type="button" className="btn solid" onClick={() => goTo("completed")}>Open Completed</button>}>Finish a game and give it a date to start your first report card.</Empty>;
  if (!summary) return null;

  const top = [...summary.games].filter(game => game.ratingScore !== null).sort((a, b) => (b.ratingScore ?? 0) - (a.ratingScore ?? 0)).slice(0, 3);
  const most = Math.max(1, ...summary.overview.months);
  const platform = summary.taste.platforms[0];

  return (
    <div className="two-pages">
      <section className="stack">
        <div className="chips">
          {years?.map(entry => <button key={entry.year} type="button" className="chip" aria-pressed={entry.year === year} onClick={() => setYear(entry.year)}>{entry.year}</button>)}
        </div>
        <h1 className="display" style={{ margin: 0, fontSize: 36, lineHeight: 1.05 }}>Your {summary.year} in games</h1>
        <span className="page-note">{summary.inProgress ? "so far — report card" : "report card"}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <div className="stat"><b>{summary.count}</b><span>finished</span></div>
          <div className="stat"><b>{summary.overview.averageRating?.toFixed(1) ?? "–"}</b><span>avg grade</span></div>
          <div className="stat"><b>{platform?.count ?? "–"}</b><span>{platform ? `on ${platform.name}` : "platform"}</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, paddingTop: 10 }} role="img" aria-label={`Games finished each month: ${summary.overview.months.join(", ")}`}>
          {summary.overview.months.map((count, index) => (
            <div key={index} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span className="hand" style={{ fontSize: 16 }}>{count}</span>
              <div style={{ width: "100%", height: Math.round((count / most) * 120) + 3, borderRadius: "4px 4px 0 0", background: "var(--blue)" }} />
              <span className="muted" style={{ fontSize: 11 }}>{MONTH_LETTERS[index]}</span>
            </div>
          ))}
        </div>
        {summary.previousYearCount !== null ? <p className="sticky">{summary.count >= summary.previousYearCount ? "Up" : "Down"} from {summary.previousYearCount} games the year before.</p> : null}
      </section>

      <section className="stack">
        <h2 className="display" style={{ margin: 0, fontSize: 24 }}>Top of the class</h2>
        {top.map((game, index) => (
          <div key={game.id} className="row" style={{ flexWrap: "nowrap", gap: 14, padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
            <span className="hand" style={{ width: 40, fontSize: 30, color: "var(--red)" }}>{PLACES[index]}</span>
            <Polaroid src={game.coverImageId ? igdbCoverSrc(game.coverImageId, "big") : null} width={58} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>{game.title}</div>
              <div className="muted">Rated {game.ratingScore}</div>
            </div>
          </div>
        ))}
        {summary.goty ? (
          <div className="sheet stack" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="page-note">Game of the Year</span>
            <Polaroid src={summary.goty.game.coverImageId ? igdbCoverSrc(summary.goty.game.coverImageId, "big") : null} tilt={-2} tape width={140} />
            <h3 className="display" style={{ margin: 0, fontSize: 22 }}>{summary.goty.game.title}</h3>
          </div>
        ) : null}
      </section>
    </div>
  );
}
