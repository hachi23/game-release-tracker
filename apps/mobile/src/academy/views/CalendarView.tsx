import { useEffect, useMemo, useState } from "react";
import type { ReleaseListItem } from "../../../../../shared/types";
import type { AcademyContext } from "../AcademyApp";
import { monthName, parseDay } from "../format";

// Calendar: the month as a timetable. On a phone each day shows a dot per release; tap a day to list them.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ context }: { context: AcademyContext }) {
  const { api, today, wide, fail, openRelease } = context;
  const [items, setItems] = useState<ReleaseListItem[]>([]);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<number | null>(today.getDate());

  useEffect(() => {
    api.listReleases({ includeReleased: true }).then(list => setItems(list.items)).catch(fail);
  }, [api, fail]);

  const byDay = useMemo(() => {
    const days = new Map<number, ReleaseListItem[]>();
    for (const item of items) {
      const day = item.datePrecision === "Exact" ? parseDay(item.releaseDate) : null;
      if (!day || day.getFullYear() !== month.getFullYear() || day.getMonth() !== month.getMonth()) continue;
      days.set(day.getDate(), [...(days.get(day.getDate()) ?? []), item]);
    }
    return days;
  }, [items, month]);

  const lead = month.getDay();
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + length) / 7) * 7 }, (_, index) => index - lead + 1);
  const total = [...byDay.values()].reduce((sum, list) => sum + list.length, 0);
  const isToday = (day: number) => day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
  const shift = (by: number) => {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + by, 1));
    setPicked(null);
  };

  return (
    <section className="stack">
      <div className="page-head" style={{ flexWrap: "nowrap" }}>
        <h1>{monthName(month.getMonth() + 1)} {month.getFullYear()}</h1>
        <button type="button" className="btn small icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
        <button type="button" className="btn small icon-btn" aria-label="Next month" onClick={() => shift(1)}>›</button>
      </div>
      <span className="page-note">{total === 1 ? "1 release" : `${total} releases`} this month</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: wide ? 6 : 3 }}>
        {WEEKDAYS.map(day => <div key={day} className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textAlign: "center" }}>{wide ? day.toUpperCase() : day[0]}</div>)}
        {cells.map(day => {
          const inMonth = day >= 1 && day <= length;
          const list = inMonth ? byDay.get(day) ?? [] : [];
          return (
            <button
              key={day}
              type="button"
              disabled={!inMonth}
              aria-label={inMonth ? `${day} ${monthName(month.getMonth() + 1)}, ${list.length} releases` : undefined}
              aria-pressed={picked === day}
              onClick={() => setPicked(day)}
              style={{
                minHeight: wide ? 96 : 52,
                padding: wide ? "4px 7px" : 4,
                border: `1px solid ${isToday(day) ? "var(--red)" : inMonth ? "var(--rule)" : "transparent"}`,
                outline: picked === day && inMonth ? "2px solid var(--blue)" : undefined,
                borderRadius: 4,
                background: isToday(day) ? "var(--sticky)" : inMonth ? "var(--sheet)" : "transparent",
                color: isToday(day) ? "var(--sticky-ink)" : "var(--ink)",
                display: "flex",
                flexDirection: "column",
                alignItems: wide ? "stretch" : "center",
                gap: 2,
                overflow: "hidden",
                textAlign: "left",
                cursor: inMonth ? "pointer" : "default"
              }}
            >
              <span className="display" style={{ fontWeight: 700, fontSize: wide ? 16 : 14 }}>{inMonth ? day : ""}</span>
              {wide
                ? list.slice(0, 3).map(item => <span key={item.id} className="hand" style={{ fontSize: 15, lineHeight: 1.05, color: "var(--blue-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</span>)
                : list.length ? <span aria-hidden="true" style={{ display: "flex", gap: 2 }}>{list.slice(0, 3).map(item => <i key={item.id} style={{ width: 6, height: 6, borderRadius: 3, background: "var(--red)" }} />)}</span> : null}
            </button>
          );
        })}
      </div>
      {picked && byDay.get(picked)?.length ? (
        <div className="ruled">
          <h2>{picked} {monthName(month.getMonth() + 1)}</h2>
          {byDay.get(picked)!.map(item => (
            <button key={item.id} type="button" className="line-row" onClick={() => openRelease(item.id)}>
              <span className="title">{item.title}</span>
              <span className="when">{item.platforms.slice(0, 2).join(", ")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
