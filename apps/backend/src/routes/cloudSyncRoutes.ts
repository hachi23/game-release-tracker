import type { CloudSyncConfigPatch } from "../../../../shared/types";
import { createCloudSyncService, type CloudSyncFetcher } from "../cloudSync/cloudSyncService";
import { runWrite } from "../database/writeQueue";
import type { BackendRouteContext } from "./context";

export function registerCloudSyncRoutes(
  { app, db, logger }: BackendRouteContext,
  { fetcher }: { fetcher?: CloudSyncFetcher } = {}
) {
  const service = createCloudSyncService(db, fetcher);

  app.get("/api/cloud-sync/status", async () => {
    return service.getStatus();
  });

  app.put("/api/cloud-sync/config", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const patch: CloudSyncConfigPatch = {};
    if (typeof body.token === "string") patch.token = body.token;
    if (typeof body.gistId === "string") patch.gistId = body.gistId;
    if (typeof body.autoSync === "boolean") patch.autoSync = body.autoSync;
    const status = await runWrite(db, () => service.saveConfig(patch));
    logger.log("cloud_sync.config.saved", { configured: status.configured, hasGistId: Boolean(status.gistId), autoSync: status.autoSync });
    return reply.send(status);
  });

  app.delete("/api/cloud-sync/config", async () => {
    const status = await runWrite(db, () => service.clearConfig());
    logger.log("cloud_sync.config.cleared");
    return status;
  });

  app.post("/api/cloud-sync/sync", async (_request, reply) => {
    const result = await service.syncNow();
    if (!result.ok) {
      logger.log("cloud_sync.failed", { error: result.error });
      return reply.code(400).send(result);
    }
    logger.log("cloud_sync.succeeded", { gistId: result.status.gistId, summary: result.summary });
    return result;
  });
}
