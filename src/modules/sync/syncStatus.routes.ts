import type { FastifyInstance } from "fastify";
import { serializeSyncStatus } from "./syncStatus.dto.js";
import type { SyncStatusService } from "./syncStatus.service.js";

export function registerSyncStatusRoutes(app: FastifyInstance, service: SyncStatusService): void {
  app.get("/api/sync-status", async () => {
    const syncStates = await service.getSyncStatus();

    return {
      data: syncStates.map(serializeSyncStatus)
    };
  });
}
