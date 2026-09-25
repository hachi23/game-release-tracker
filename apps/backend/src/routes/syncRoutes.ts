import { startSync } from "../sync/syncRun";
import { getSyncStatus } from "../sync/syncStatus";
import type { BackendRouteContext } from "./context";

export function registerSyncRoutes({ app, db, igdb }: BackendRouteContext) {
  app.post("/api/sync/igdb", async () => startSync(db, undefined, igdb));
  app.get("/api/sync/status", async () => getSyncStatus(db));

}
