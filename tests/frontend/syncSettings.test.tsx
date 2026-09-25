// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { AppShell } from "../../apps/frontend/src/App";
import type { SyncSettings } from "../../shared/types";
import { fakeApiClient } from "./fakeApiClient";
import { click, getButton, renderInteractive, typeInto } from "./domHarness";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

const newLibrary: SyncSettings = { publishers: [], platforms: ["pc", "xbox", "playstation", "switch"], trackFrom: "2026-01-01", autoSync: false };

async function openSyncSettings(settings: SyncSettings = newLibrary, overrides = {}) {
  let current = settings;
  const api = fakeApiClient({
    getSyncSettings: async () => current,
    updateSyncSettings: async patch => (current = { ...current, ...patch }),
    searchPublishers: async () => ({ items: [{ id: 37, name: "Capcom" }, { id: 9, name: "Capcom Vancouver" }] }),
    trackPublisher: async publisher => (current = { ...current, publishers: [...current.publishers, publisher] }),
    untrackPublisher: async id => (current = { ...current, publishers: current.publishers.filter(publisher => publisher.id !== id) }),
    trackSuggestedPublishers: async () => ({ ...(current = { ...current, publishers: [{ id: 70, name: "Nintendo" }, { id: 112, name: "Sega" }] }), notFound: ["Konami"] }),
    ...overrides
  });
  const view = await renderInteractive(<AppShell apiBaseUrl="http://unused" api={api} />);
  cleanups.push(view.cleanup);
  await click(getButton(view.container, "Settings"));
  await click(getButton(view.container, "Sync"));
  return { ...view, api };
}

const publisherNames = (container: Element) => [...container.querySelectorAll(".sync-publishers__chip")].map(chip => chip.firstChild?.textContent);

describe("Settings → Sync", () => {
  test("a new library explains that sync needs publishers and offers the suggested set", async () => {
    const { container, api } = await openSyncSettings();

    expect(container.querySelector(".sync-publishers__empty")?.textContent).toContain("No publishers tracked yet");
    await click(getButton(container, "Add suggested publishers"));

    expect(api.trackSuggestedPublishers).toHaveBeenCalledTimes(1);
    expect(publisherNames(container)).toEqual(["Nintendo", "Sega"]);
    expect(container.textContent).toContain("IGDB didn't know: Konami");
  });

  test("publishers are found by search, added and removed", async () => {
    const { container, api } = await openSyncSettings();

    await typeInto(container.querySelector('input[aria-label="Search publishers"]')!, "cap");
    await click(getButton(container, "Search"));
    await click(getButton(container, "Add Capcom"));
    expect(api.trackPublisher).toHaveBeenCalledWith({ id: 37, name: "Capcom" });
    expect(publisherNames(container)).toEqual(["Capcom"]);

    await click(getButton(container, "Stop tracking Capcom"));
    expect(api.untrackPublisher).toHaveBeenCalledWith(37);
    expect(publisherNames(container)).toEqual([]);
  });

  test("platforms, the track-from date and auto-sync save as they change", async () => {
    const { container, api } = await openSyncSettings();

    await click(container.querySelector('input[aria-label="PlayStation"]') as HTMLInputElement);
    expect(api.updateSyncSettings).toHaveBeenLastCalledWith({ platforms: ["pc", "xbox", "switch"] });

    await typeInto(container.querySelector('input[aria-label="Track releases from"]')!, "2025-06-01");
    expect(api.updateSyncSettings).toHaveBeenLastCalledWith({ trackFrom: "2025-06-01" });

    await click(container.querySelector('input[aria-label="Sync automatically when the app starts"]') as HTMLInputElement);
    expect(api.updateSyncSettings).toHaveBeenLastCalledWith({ autoSync: true });
  });

  test("the last platform can't be turned off", async () => {
    const { container } = await openSyncSettings({ ...newLibrary, platforms: ["pc"] });

    expect((container.querySelector('input[aria-label="PC"]') as HTMLInputElement).disabled).toBe(true);
  });
});
