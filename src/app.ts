import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { ContractRepository } from "./modules/contracts/contract.repository.js";
import { registerContractRoutes } from "./modules/contracts/contract.routes.js";
import { ContractService } from "./modules/contracts/contract.service.js";
import { registerEventRoutes } from "./modules/events/event.routes.js";
import { EventService } from "./modules/events/event.service.js";
import { IndexedEventRepository } from "./modules/events/indexedEvent.repository.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { SyncStateRepository } from "./modules/sync/syncState.repository.js";
import { registerSyncStatusRoutes } from "./modules/sync/syncStatus.routes.js";
import { SyncStatusService } from "./modules/sync/syncStatus.service.js";
import { registerWalletRoutes } from "./modules/wallets/wallet.routes.js";

export interface BuildAppOptions {
  logger: Logger;
  prisma: PrismaClient;
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    loggerInstance: options.logger
  });

  await app.register(cors, {
    origin: false
  });

  registerHealthRoutes(app as unknown as FastifyInstance, {
    prisma: options.prisma
  });

  const contractService = new ContractService(new ContractRepository(options.prisma));
  const eventService = new EventService(new IndexedEventRepository(options.prisma));
  const syncStatusService = new SyncStatusService(new SyncStateRepository(options.prisma));

  registerContractRoutes(app as unknown as FastifyInstance, contractService);
  registerEventRoutes(app as unknown as FastifyInstance, eventService);
  registerWalletRoutes(app as unknown as FastifyInstance, eventService);
  registerSyncStatusRoutes(app as unknown as FastifyInstance, syncStatusService);

  app.addHook("onClose", async () => {
    await options.prisma.$disconnect();
  });

  return app;
}
