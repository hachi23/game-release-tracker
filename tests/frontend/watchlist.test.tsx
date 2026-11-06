// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { AppShell } from "../../apps/frontend/src/App";
import type { ReleaseDetail, ReleaseListItem } from "../../shared/types";
import { fakeApiClient } from "./fakeApiClient";
import { click, getButton, renderInteractive } from "./domHarness";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

const release = (id: string, title: string, watched = false) => ({
  id, title, normalizedTitle: title.toLowerCase(), dateText: "2027", releaseDate: "2027-01-01", datePrecision: "Year",
  releaseWindow: null, category: "Main", publishers: ["Sample Co"], developers: [], platforms: ["PC"], genres: [], artworks: [],
  eligible: true, eligibilityReason: null, effectiveSortDate: "2027-01-01", hidden: false, watched, released: false, sourceConfidence: 90
}) as unknown as ReleaseListItem;

async function openApp() {
  const items = [release("a", "Alpha Quest"), release("b", "Beta Saga")];
  const api = fakeApiClient({
    listReleases: async params => {
      const shown = params?.watchedOnly ? items.filter(item => item.watched) : items;
      return { items: shown.map(item => ({ ...item })), truncated: false, total: shown.length };
    },
    getDemo: async () => ({ loaded: true }),
    patchRelease: async (id, payload) => {
      const item = items.find(entry => entry.id === id)!;
      item.watched = Boolean(payload.watched);
      return { ok: true, item: { ...item, sources: [], igdbUrl: null, screenshots: [], trailers: [] } as unknown as ReleaseDetail };
    }
  });
  const view = await renderInteractive(<AppShell apiBaseUrl="http://unused" api={api} />);
  cleanups.push(view.cleanup);
  return { ...view, api };
}

const rowTitles = (container: Element) => [...container.querySelectorAll(".release-row strong")].map(node => node.textContent);

describe("watchlist", () => {
  test("Watch on the featured game saves it, stars its row, and Watched only lists just that game", async () => {
    const { container, api } = await openApp();
    expect(rowTitles(container)).toEqual(["Alpha Quest", "Beta Saga"]);

    await click(getButton(container, "☆ Watch"));
    expect(api.patchRelease).toHaveBeenCalledWith("a", { watched: true });
    expect(rowTitles(container)).toEqual(["★ Alpha Quest", "Beta Saga"]);
    expect(getButton(container, "★ Watching").getAttribute("aria-pressed")).toBe("true");

    await click(getButton(container, "More filters"));
    const watchedOnly = [...container.querySelectorAll("label")].find(label => label.textContent?.includes("Watched only"))!.querySelector("input")!;
    await click(watchedOnly);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(rowTitles(container)).toEqual(["★ Alpha Quest"]);

    await click(getButton(container, "★ Watching"));
    expect(api.patchRelease).toHaveBeenLastCalledWith("a", { watched: false });
  });
});
