// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { CompletedGameListItem } from "../../shared/types";
import type { AcademyContext } from "../../apps/mobile/src/academy/AcademyApp";
import type { MobileApiClient } from "../../apps/mobile/src/mobileApiClient";
import { CompletedView } from "../../apps/mobile/src/academy/views/CompletedView";
import { fakeApiClient } from "../frontend/fakeApiClient";
import { renderInteractive } from "../frontend/domHarness";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

const game = (id: string, title: string, completion: Partial<CompletedGameListItem>): CompletedGameListItem => ({
  id, title, normalizedTitle: title.toLowerCase(), userPlatform: "PC", genres: [], igdbGenres: [], platforms: [],
  matchStatus: "matched", completionPrecision: "none", ...completion
});

test("Android Completed groups finished games under month headings, newest first, undated last, like the desktop", async () => {
  const items = [
    game("a", "Astral Tide", { completionDate: "2026-03-14", completionMonth: "2026-03", completionYear: 2026, completionPrecision: "exact" }),
    game("b", "Brass Lantern", { completionMonth: "2026-10", completionYear: 2026, completionPrecision: "month" }),
    game("c", "Cinder Vale", { completionYear: 2025, completionPrecision: "year" }),
    game("d", "Dusk Harbor", { completionDate: "2026-10-02", completionMonth: "2026-10", completionYear: 2026, completionPrecision: "exact" })
  ];
  const api = fakeApiClient({ listCompletedGames: async () => ({ items, total: items.length }) }) as unknown as MobileApiClient;
  const context = { api, today: new Date(2026, 10, 11), wide: false, fail: vi.fn(), notify: vi.fn(), openCompleted: vi.fn() } as unknown as AcademyContext;

  const view = await renderInteractive(<CompletedView context={context} />);
  cleanups.push(view.cleanup);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });

  const sections = [...view.container.querySelectorAll("section.completed-month")].map(section => ({
    heading: section.querySelector("h2")?.textContent,
    titles: [...section.querySelectorAll("button")].map(button => button.getAttribute("aria-label"))
  }));
  expect(sections).toEqual([
    { heading: "October 2026", titles: ["Brass Lantern, rated –", "Dusk Harbor, rated –"] },
    { heading: "March 2026", titles: ["Astral Tide, rated –"] },
    { heading: "Undated Completed Games", titles: ["Cinder Vale, rated –"] }
  ]);
});
