import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/db/prisma.js";
import { createLogger } from "./infrastructure/logger/logger.js";
import { EthersBlockchainClient } from "./infrastructure/rpc/blockchainClient.js";
import { ContractConfigRepository } from "./modules/contracts/contractConfig.repository.js";
import { ContractConfigService } from "./modules/contracts/contractConfig.service.js";
import { EventParticipantRepository } from "./modules/events/eventParticipant.repository.js";
import { IndexedEventRepository } from "./modules/events/indexedEvent.repository.js";
import { BatchPersistenceService } from "./modules/sync/batchPersistence.service.js";
import { IndexerService } from "./modules/sync/indexer.service.js";
import { SyncStateRepository } from "./modules/sync/syncState.repository.js";

async function startServer(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const prisma = createPrismaClient(logger);
  const app = await buildApp({ logger, prisma });
  const indexedEventRepository = new IndexedEventRepository(prisma);
  const eventParticipantRepository = new EventParticipantRepository(prisma);
  const syncStateRepository = new SyncStateRepository(prisma);
  const indexer =
    config.INDEXER_ENABLED && config.ETHEREUM_RPC_URL
      ? new IndexerService({
          config,
          blockchainClient: new EthersBlockchainClient(config.ETHEREUM_RPC_URL),
          contractConfigService: new ContractConfigService(new ContractConfigRepository(prisma)),
          batchPersistenceService: new BatchPersistenceService(
            prisma,
            indexedEventRepository,
            eventParticipantRepository,
            syncStateRepository
          ),
          syncStateRepository,
          logger
        })
      : null;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    await indexer?.stop();
    await app.close();
  };

  process.once("SIGINT", (signal) => {
    void shutdown(signal);
  });
  process.once("SIGTERM", (signal) => {
    void shutdown(signal);
  });

  await app.listen({
    host: config.HOST,
    port: config.PORT
  });

  if (indexer) {
    await indexer.start();
  }
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
