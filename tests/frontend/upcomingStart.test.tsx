// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { findUpcomingStart, isUpcomingRelease } from "../../shared/upcomingStart";
import type { ReleaseListItem } from "../../shared/types";
import { AppShell } from "../../apps/frontend/src/App";
import { UpcomingView as MobileUpcomingView } from "../../apps/mobile/src/academy/views/UpcomingView";
import { invalidateUpcomingCache } from "../../apps/mobile/src/academy/listCache";
import type { AcademyContext } from "../../apps/mobile/src/academy/AcademyApp";
import type { MobileApiClient } from "../../apps/mobile/src/mobileApiClient";
import { fakeApiClient } from "./fakeApiClient";
import { click, getButton, renderInteractive } from "./domHarness";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.useRealTimers();
  invalidateUpcomingCache();
  while (cleanups.length) await cleanups.pop()!();
});

function release(overrides: Partial<ReleaseListItem> & { id: string; title: string }): ReleaseListItem {
  return {
    dateText: "Nov 28, 2026",
    releaseDate: "2026-11-28",
    datePrecision: "Exact",
    releaseWindow: null,
    effectiveSortDate: "2026-11-28",
    category: "Main",
    publishers: ["Sample Co"],
    developers: [],
    platforms: ["PC"],
    genres: [],
    sourceConfidence: 90,
    artworks: [],
    eligible: true,
    hidden: false,
    watched: false,
    released: false,
    ...overrides
  };
}

describe("upcomingStart (shared anchor)", () => {
  const today = new Date(2026, 10, 26); // Nov 26, 2026

  test("classifies Exact, Month, Window, Year, and TBA precisions against today", () => {
    expect(isUpcomingRelease(release({ id: "1", title: "Past Day", releaseDate: "2026-11-25", effectiveSortDate: "2026-11-25" }), today)).toBe(false);
    expect(isUpcomingRelease(release({ id: "2", title: "Today", releaseDate: "2026-11-26", effectiveSortDate: "2026-11-26" }), today)).toBe(true);
    expect(isUpcomingRelease(release({ id: "3", title: "Past Month", datePrecision: "Month", dateText: "Mar 2026", releaseDate: "2026-03-31", effectiveSortDate: "2026-03-31" }), today)).toBe(false);
    expect(isUpcomingRelease(release({ id: "4", title: "Current Month", datePrecision: "Month", dateText: "Nov 2026", releaseDate: "2026-11-30", effectiveSortDate: "2026-11-30" }), today)).toBe(true);
    expect(isUpcomingRelease(release({ id: "5", title: "Past Window", datePrecision: "Window", dateText: "Q1 2026", releaseDate: null, releaseWindow: "Q1 2026", effectiveSortDate: "2026-01-01" }), today)).toBe(false);
    expect(isUpcomingRelease(release({ id: "6", title: "Current Window", datePrecision: "Window", dateText: "Q4 2026", releaseDate: null, releaseWindow: "Q4 2026", effectiveSortDate: "2026-10-01" }), today)).toBe(true);
    expect(isUpcomingRelease(release({ id: "7", title: "Past Year", datePrecision: "Year", dateText: "2025", releaseDate: null, effectiveSortDate: "2025-01-01" }), today)).toBe(false);
    expect(isUpcomingRelease(release({ id: "8", title: "Future Year", datePrecision: "Year", dateText: "2027", releaseDate: null, effectiveSortDate: "2027-01-01" }), today)).toBe(true);
  });

  test("skips earlier released months and anchors on the first upcoming month and game", () => {
    const groups = [
      { name: "January", items: [release({ id: "jan", title: "Jan Game", releaseDate: "2026-01-15", effectiveSortDate: "2026-01-15" })] },
      { name: "March", items: [release({ id: "mar", title: "Mar Month", datePrecision: "Month", dateText: "Mar 2026", releaseDate: "2026-03-31", effectiveSortDate: "2026-03-31" })] },
      {
        name: "November",
        items: [
          release({ id: "nov-past", title: "Nov Early", releaseDate: "2026-11-05", effectiveSortDate: "2026-11-05" }),
          release({ id: "nov-next", title: "Nov Next", releaseDate: "2026-11-28", effectiveSortDate: "2026-11-28" })
        ]
      },
      { name: "December", items: [release({ id: "dec", title: "Dec Game", releaseDate: "2026-12-10", effectiveSortDate: "2026-12-10" })] }
    ];

    const start = findUpcomingStart(groups, today);
    expect(start.groupIndex).toBe(2);
    expect(start.itemIndex).toBe(1);
    expect(start.item?.id).toBe("nov-next");
    expect(start.earlierGroupCount).toBe(2);
  });

  test("falls back to the latest month when all listed games are already out", () => {
    const groups = [
      { name: "January", items: [release({ id: "jan", title: "Jan Game", releaseDate: "2026-01-15", effectiveSortDate: "2026-01-15" })] },
      { name: "October", items: [release({ id: "oct", title: "Oct Game", releaseDate: "2026-10-20", effectiveSortDate: "2026-10-20" })] }
    ];
    const start = findUpcomingStart(groups, today);
    expect(start.groupIndex).toBe(1);
    expect(start.item?.id).toBe("oct");
  });
});

describe("Desktop UpcomingView anchor", () => {
  test("features the first upcoming release and scrolls the list to its month section", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 26, 12, 0, 0));

    let resolveReleases!: (value: { items: ReleaseListItem[]; total: number; truncated: boolean }) => void;
    const api = fakeApiClient({
      getDemo: async () => ({ loaded: false }),
      listReleases: () => new Promise(resolve => { resolveReleases = resolve; })
    });

    const view = await renderInteractive(<AppShell apiBaseUrl="http://unused" api={api} />);
    cleanups.push(view.cleanup);

    // Simulate real browser layout on the fresh JSDOM window: November section sits 420px below the scroll top.
    const win = view.container.ownerDocument.defaultView!;
    const origRect = win.HTMLElement.prototype.getBoundingClientRect;
    win.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.getAttribute("data-upcoming-start") === "true") {
        return { top: 420, bottom: 520, left: 0, right: 300, width: 300, height: 100, x: 0, y: 420, toJSON: () => ({}) } as DOMRect;
      }
      return origRect.call(this);
    };

    const { act } = await import("react");
    await act(async () => {
      resolveReleases({
        items: [
          release({ id: "jan", title: "January Game", dateText: "Jan 15, 2026", releaseDate: "2026-01-15", effectiveSortDate: "2026-01-15" }),
          release({ id: "nov-next", title: "November Next", dateText: "Nov 28, 2026", releaseDate: "2026-11-28", effectiveSortDate: "2026-11-28" }),
          release({ id: "dec", title: "December Big", dateText: "Dec 12, 2026", releaseDate: "2026-12-12", effectiveSortDate: "2026-12-12" })
        ],
        total: 3,
        truncated: false
      });
    });

    expect(view.container.querySelector(".upcoming-feature h2")?.textContent).toBe("November Next");
    expect(view.container.querySelector('section[data-upcoming-start="true"] h2')?.textContent).toBe("November");
    expect(view.container.querySelector(".upcoming-list__scroll")?.scrollTop).toBe(420);
  });
});

describe("Android UpcomingView anchor and Sync now reload", () => {
  test("opens at the current/next upcoming month, expands earlier months on tap, and reloads after Sync now", async () => {
    const today = new Date(2026, 10, 26, 12, 0, 0);
    let synced = false;
    const baseItems = [
      release({ id: "jan", title: "January Old", dateText: "Jan 15, 2026", releaseDate: "2026-01-15", effectiveSortDate: "2026-01-15" }),
      release({ id: "nov", title: "November Upcoming", dateText: "Nov 28, 2026", releaseDate: "2026-11-28", effectiveSortDate: "2026-11-28" })
    ];
    const newPubItem = release({ id: "dec-new", title: "New Publisher Game", dateText: "Dec 5, 2026", releaseDate: "2026-12-05", effectiveSortDate: "2026-12-05" });

    const api = {
      ...fakeApiClient({
        getDemo: async () => ({ loaded: false }),
        listReleases: async () => {
          const items = synced ? [...baseItems, newPubItem] : baseItems;
          return { items, total: items.length, truncated: false };
        },
        syncNow: async () => {
          synced = true;
          return { status: "success", added: 1, repaired: 0, skipped: 0, failed: 0, message: "Sync complete" };
        }
      }),
      takeAlerts: async () => []
    } as unknown as MobileApiClient;

    const context: AcademyContext = {
      api,
      today,
      wide: false,
      term: "night",
      setTerm: () => undefined,
      detailTint: "40",
      setDetailTint: () => undefined,
      wallpaper: null,
      setWallpaperFromFile: async () => undefined,
      clearWallpaper: () => undefined,
      notify: () => undefined,
      fail: () => undefined,
      openRelease: () => undefined,
      openCompleted: () => undefined,
      goTo: () => undefined,
      back: () => undefined
    };

    const view = await renderInteractive(<MobileUpcomingView context={context} />);
    cleanups.push(view.cleanup);

    // Opens directly on November, not January.
    expect(view.container.textContent).toContain("November Upcoming");
    expect(view.container.textContent).not.toContain("January Old");
    expect(view.container.textContent).toContain("Show earlier months (1)");

    // Tapping Sync now invalidates the cache and immediately shows the newly synced publisher's game.
    await click(getButton(view.container, "Sync now"));
    expect(view.container.textContent).toContain("New Publisher Game");

    // Earlier months are one tap away.
    await click(getButton(view.container, "↑ Show earlier months (1)"));
    expect(view.container.textContent).toContain("January Old");
  });
});
