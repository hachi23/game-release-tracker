import { readPreferences, savePalette } from "../actions/preferencesActions";
import { sendActionResult } from "./actionResult";
import type { BackendRouteContext } from "./context";

export function registerPreferencesRoutes({ app, db }: BackendRouteContext) {
  app.get("/api/preferences", async () => readPreferences(db));

  app.put("/api/preferences/palette", async (request, reply) => sendActionResult(reply, await savePalette(db, request.body)));
}
