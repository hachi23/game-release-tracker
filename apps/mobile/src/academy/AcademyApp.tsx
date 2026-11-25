import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MobileApiClient } from "../mobileApiClient";
import type { LibraryTransfer } from "../boot";
import { useDetailTint, type DetailBgTint } from "./coverPalette";
import { todayLabel } from "./format";
import { useTerm, type TermChoice } from "./term";
import { Crest, Icon } from "./ui";
import { useWallpaper } from "./wallpaper";
import { UpcomingView } from "./views/UpcomingView";
import { CompletedView } from "./views/CompletedView";
import { ReleaseDetailView } from "./views/ReleaseDetailView";
import { CompletedDetailView } from "./views/CompletedDetailView";

// Lazy-load secondary tabs so cold start stays lean while core navigation (Upcoming, Completed, Details) is instant.
const CalendarView = lazy(() => import("./views/CalendarView").then(m => ({ default: m.CalendarView })));
const RandomizerView = lazy(() => import("./views/RandomizerView").then(m => ({ default: m.RandomizerView })));
const YearView = lazy(() => import("./views/YearView").then(m => ({ default: m.YearView })));
const SettingsView = lazy(() => import("./views/SettingsView").then(m => ({ default: m.SettingsView })));

export type Tab = "upcoming" | "calendar" | "completed" | "randomizer" | "year" | "settings";
type Screen = { tab: Tab } | { tab: Tab; release: string } | { tab: Tab; completed: string };

export interface AcademyContext {
  api: MobileApiClient;
  library?: LibraryTransfer;
  today: Date;
  wide: boolean;
  term: TermChoice;
  setTerm: (term: TermChoice) => void;
  detailTint: DetailBgTint;
  setDetailTint: (tint: DetailBgTint) => void;
  wallpaper: string | null;
  setWallpaperFromFile: (file: File) => Promise<void>;
  clearWallpaper: () => void;
  notify: (message: string) => void;
  fail: (error: unknown) => void;
  openRelease: (id: string) => void;
  openCompleted: (id: string) => void;
  goTo: (tab: Tab) => void;
  back: () => void;
}

const TABS: Array<{ id: Tab; label: string; short: string; icon: string; color: string }> = [
  { id: "upcoming", label: "Upcoming", short: "Upcoming", icon: "upcoming", color: "var(--ribbon-1)" },
  { id: "calendar", label: "Calendar", short: "Calendar", icon: "calendar", color: "var(--ribbon-2)" },
  { id: "completed", label: "Completed", short: "Finished", icon: "library", color: "var(--ribbon-3)" },
  { id: "randomizer", label: "Randomizer", short: "Spin", icon: "spin", color: "var(--ribbon-4)" },
  { id: "year", label: "Year in Review", short: "Year", icon: "year", color: "var(--ribbon-5)" },
  { id: "settings", label: "Settings", short: "Settings", icon: "settings", color: "var(--ribbon-6)" }
];

function useWide() {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setWide(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return wide;
}

export function AcademyApp({ api, library, registerOpenRelease, onBackButton }: {
  api: MobileApiClient;
  library?: LibraryTransfer;
  registerOpenRelease?: (open: (id: string) => void) => void;
  onBackButton?: (handler: () => boolean) => void;
}) {
  const [stack, setStack] = useState<Screen[]>([{ tab: "upcoming" }]);
  const [notice, setNotice] = useState<string | null>(null);
  const [today] = useState(() => new Date());
  const wide = useWide();
  const [term, setTerm] = useTerm();
  const [detailTint, setDetailTint] = useDetailTint();
  const { wallpaper, setWallpaperFromFile, clearWallpaper } = useWallpaper();
  const screen = stack[stack.length - 1];

  const notify = useCallback((message: string) => setNotice(message), []);
  const fail = useCallback((error: unknown) => setNotice(error instanceof Error ? error.message : String(error)), []);
  const openRelease = useCallback((id: string) => setStack(current => [...current, { tab: current[current.length - 1].tab, release: id }]), []);
  const openCompleted = useCallback((id: string) => setStack(current => [...current, { tab: current[current.length - 1].tab, completed: id }]), []);
  const goTo = useCallback((tab: Tab) => setStack([{ tab }]), []);
  const back = useCallback(() => setStack(current => (current.length > 1 ? current.slice(0, -1) : current)), []);

  useEffect(() => {
    registerOpenRelease?.(openRelease);
  }, [registerOpenRelease, openRelease]);
  useEffect(() => {
    onBackButton?.(() => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
  }, [onBackButton, stack.length, back]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const context = useMemo<AcademyContext>(
    () => ({
      api,
      library,
      today,
      wide,
      term,
      setTerm,
      detailTint,
      setDetailTint,
      wallpaper,
      setWallpaperFromFile,
      clearWallpaper,
      notify,
      fail,
      openRelease,
      openCompleted,
      goTo,
      back
    }),
    [api, library, today, wide, term, setTerm, detailTint, setDetailTint, wallpaper, setWallpaperFromFile, clearWallpaper, notify, fail, openRelease, openCompleted, goTo, back]
  );

  const isDetail = "release" in screen || "completed" in screen;
  const spread = wide && !isDetail && screen.tab !== "calendar";
  const bgStyle = wallpaper ? ({ ["--a-wallpaper" as string]: `url(${wallpaper})` } as CSSProperties) : undefined;

  return (
    <div className="academy" data-wallpaper={wallpaper ? "true" : undefined}>
      {/* Static GPU-promoted backdrop layer: renders the custom wallpaper crisp and unblurred like desktop. */}
      <div className={`academy__bg${wallpaper ? " academy__bg--wallpaper" : ""}`} style={bgStyle} aria-hidden="true" />

      <header className="crest-bar">
        <Crest />
        <div>
          <div className="name">Game Release Tracker</div>
          <div className="edition">Academy Edition</div>
        </div>
        <span className="date">{todayLabel(today)}</span>
      </header>

      {notice ? (
        <div className="notice" role="status">
          <p className="sticky">{notice}</p>
          <button type="button" className="btn small solid" onClick={() => setNotice(null)}>OK</button>
        </div>
      ) : null}

      <div className="book-stage">
        <div className={`book${spread ? " spread" : ""}`} data-detail={isDetail ? "true" : undefined}>
          <main className={`page${isDetail ? " page--detail" : ""}`}>
            <Suspense fallback={<div className="empty"><p>Opening page…</p></div>}>
              {"release" in screen ? (
                <ReleaseDetailView key={screen.release} id={screen.release} context={context} />
              ) : "completed" in screen ? (
                <CompletedDetailView key={screen.completed} id={screen.completed} context={context} />
              ) : screen.tab === "upcoming" ? (
                <UpcomingView context={context} />
              ) : screen.tab === "calendar" ? (
                <CalendarView context={context} />
              ) : screen.tab === "completed" ? (
                <CompletedView context={context} />
              ) : screen.tab === "randomizer" ? (
                <RandomizerView context={context} />
              ) : screen.tab === "year" ? (
                <YearView context={context} />
              ) : (
                <SettingsView context={context} />
              )}
            </Suspense>
          </main>
        </div>

        <nav className="ribbons" aria-label="Notebook sections">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className="ribbon"
              style={{ ["--ribbon-color" as string]: tab.color }}
              aria-current={screen.tab === tab.id ? "page" : undefined}
              onClick={() => goTo(tab.id)}
            >
              <Icon name={tab.icon} size={19} />
              <span>{wide ? tab.label : tab.short}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
