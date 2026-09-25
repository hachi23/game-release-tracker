import type { TrackerDatabase } from "../database/db";
import { runWrite } from "../database/writeQueue";
import { createSettingsStore } from "../settings/settingsStore";
import type { ActionResult } from "./actionResult";

// App-wide look-and-feel choices. They live in app data, not the renderer's localStorage: the window's
// origin is the backend's port, which changes every launch, so localStorage starts empty each time.
const PALETTE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function readPreferences(db: TrackerDatabase) {
  return { palette: createSettingsStore(db).palette() };
}

export async function savePalette(db: TrackerDatabase, body: unknown): Promise<ActionResult<{ palette: string }>> {
  const palette = (body as { palette?: unknown } | null)?.palette;
  if (typeof palette !== "string" || !PALETTE_ID.test(palette)) return { ok: false, statusCode: 400, error: "Palette must be a palette id" };
  await runWrite(db, () => createSettingsStore(db).setPalette(palette));
  return { ok: true, value: { palette } };
}
