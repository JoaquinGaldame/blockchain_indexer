import type { Logger } from "pino";
import type { AppConfig } from "../../config/env.js";
import type { BlockchainClient } from "../../infrastructure/rpc/blockchainClient.js";
import { EventDecoder } from "../blockchain/eventDecoder.js";
import type { ContractConfigService } from "../contracts/contractConfig.service.js";
import type { ContractConfig } from "../contracts/contractConfig.types.js";
import type { DecodedIndexedEvent } from "../events/indexedEvent.types.js";
import type { BatchPersistenceService } from "./batchPersistence.service.js";
import type { SyncStateRepository } from "./syncState.repository.js";

interface IndexerServiceOptions {
  config: AppConfig;
  blockchainClient: BlockchainClient;
  contractConfigService: ContractConfigService;
  batchPersistenceService: BatchPersistenceService;
  syncStateRepository: SyncStateRepository;
  logger: Logger;
}

export class IndexerService {
  private stopped = true;
  private liveLoop?: Promise<void>;
  private wakeLiveLoop?: () => void;

  constructor(private readonly options: IndexerServiceOptions) {}

  async start(): Promise<void> {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;

    await this.syncToSafeHead("LIVE");
    this.liveLoop = this.runLiveLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.wakeLiveLoop?.();
    await this.liveLoop;
    this.options.blockchainClient.destroy();
  }

  async syncToSafeHead(finalStatus: "LIVE" | "SYNCING" = "LIVE"): Promise<void> {
    const contracts = await this.options.contractConfigService.getActiveContracts(
      this.options.config.INDEXER_NETWORK
    );

    if (contracts.length === 0) {
      this.options.logger.warn(
        { network: this.options.config.INDEXER_NETWORK },
        "No active contracts configured for indexing"
      );
      return;
    }

    const safeBlock = await this.getSafeBlockNumber();

    for (const contract of contracts) {
      if (this.stopped) {
        return;
      }

      await this.syncContract(contract, safeBlock, finalStatus);
    }
  }

  private async runLiveLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.syncToSafeHead("LIVE");
      } catch (error) {
        this.options.logger.error({ error }, "Live sync iteration failed");
      }

      await this.sleep(this.options.config.INDEXER_POLL_INTERVAL_MS);
    }
  }

  private async syncContract(
    contract: ContractConfig,
    safeBlock: bigint,
    finalStatus: "LIVE" | "SYNCING"
  ): Promise<void> {
    const syncState = await this.options.syncStateRepository.ensure(contract);
    const fromBlock = this.maxBigInt(syncState.lastSyncedBlock + 1n, contract.startBlock);

    this.options.logger.info(
      {
        contract: contract.name,
        address: contract.address,
        lastSyncedBlock: syncState.lastSyncedBlock.toString(),
        resumeFromBlock: fromBlock.toString(),
        safeBlock: safeBlock.toString(),
        status: syncState.status
      },
      "Sync resumed"
    );

    if (fromBlock > safeBlock) {
      await this.options.syncStateRepository.markLive(contract.id);
      return;
    }

    await this.options.syncStateRepository.markSyncing(contract.id);

    const decoder = new EventDecoder(contract);
    let cursor = fromBlock;

    try {
      while (cursor <= safeBlock && !this.stopped) {
        const toBlock = this.minBigInt(
          cursor + BigInt(this.options.config.INDEXER_BATCH_SIZE - 1),
          safeBlock
        );

        this.options.logger.info(
          {
            contract: contract.name,
            address: contract.address,
            fromBlock: cursor.toString(),
            toBlock: toBlock.toString()
          },
          "Batch start"
        );

        const decodedEvents = await this.decodeRange(contract, decoder, cursor, toBlock);
        const toBlockRef = await this.options.blockchainClient.getBlockReference(toBlock);
        const result = await this.options.batchPersistenceService.persistBatch({
          contractId: contract.id,
          events: decodedEvents,
          lastSyncedBlock: toBlockRef.number,
          lastSyncedBlockHash: toBlockRef.hash.toLowerCase(),
          status: toBlock === safeBlock ? finalStatus : "SYNCING"
        });

        if (result.duplicates > 0) {
          this.options.logger.warn(
            {
              contract: contract.name,
              address: contract.address,
              fromBlock: cursor.toString(),
              toBlock: toBlock.toString(),
              duplicates: result.duplicates
            },
            "Duplicate indexed events skipped"
          );
        }

        this.options.logger.info(
          {
            contract: contract.name,
            address: contract.address,
            fromBlock: cursor.toString(),
            toBlock: toBlock.toString(),
            attempted: result.attempted,
            inserted: result.inserted,
            duplicates: result.duplicates
          },
          "Batch success"
        );

        cursor = toBlock + 1n;
      }
    } catch (error) {
      await this.options.syncStateRepository.markError(contract.id, error);
      this.options.logger.error(
        {
          error,
          contract: contract.name,
          address: contract.address,
          fromBlock: cursor.toString(),
          safeBlock: safeBlock.toString()
        },
        "Batch failure"
      );
    }
  }

  private async decodeRange(
    contract: ContractConfig,
    decoder: EventDecoder,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<DecodedIndexedEvent[]> {
    const logs = await this.options.blockchainClient.getLogs({
      address: contract.address,
      fromBlock,
      toBlock
    });

    const decodedEvents = logs
      .map((log) => decoder.decode(log))
      .filter((event) => event !== null);

    return decodedEvents;
  }

  private async getSafeBlockNumber(): Promise<bigint> {
    const latest = await this.options.blockchainClient.getLatestBlockNumber();
    const confirmations = BigInt(this.options.config.INDEXER_CONFIRMATIONS);

    if (latest <= confirmations) {
      return 0n;
    }

    return latest - confirmations;
  }

  private minBigInt(left: bigint, right: bigint): bigint {
    return left < right ? left : right;
  }

  private maxBigInt(left: bigint, right: bigint): bigint {
    return left > right ? left : right;
  }

  private async sleep(ms: number): Promise<void> {
    if (this.stopped) {
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        this.wakeLiveLoop = undefined;
        resolve();
      };
      const timeout = setTimeout(finish, ms);

      this.wakeLiveLoop = () => {
        clearTimeout(timeout);
        finish();
      };
    });
  }
}
