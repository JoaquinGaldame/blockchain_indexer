import type { PrismaClient, SyncStatus } from "@prisma/client";
import type { EventParticipantRepository } from "../events/eventParticipant.repository.js";
import type { IndexedEventRepository } from "../events/indexedEvent.repository.js";
import type { DecodedIndexedEvent } from "../events/indexedEvent.types.js";
import type { SyncStateRepository } from "./syncState.repository.js";

export interface PersistBatchInput {
  contractId: string;
  events: DecodedIndexedEvent[];
  lastSyncedBlock: bigint;
  lastSyncedBlockHash: string;
  status: SyncStatus;
}

export interface PersistBatchResult {
  attempted: number;
  inserted: number;
  duplicates: number;
}

export class BatchPersistenceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly indexedEventRepository: IndexedEventRepository,
    private readonly eventParticipantRepository: EventParticipantRepository,
    private readonly syncStateRepository: SyncStateRepository
  ) {}

  async persistBatch(input: PersistBatchInput): Promise<PersistBatchResult> {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.indexedEventRepository.saveMany(input.events, tx);
      const persistedEvents = await this.indexedEventRepository.findManyByUniqueKeys(
        input.events.map((event) => ({
          contractId: event.contractId,
          txHash: event.txHash,
          logIndex: event.logIndex
        })),
        tx
      );
      const indexedEventIdByKey = new Map(
        persistedEvents.map((event) => [
          [event.contractId, event.txHash, event.logIndex.toString()].join("|"),
          event.id
        ])
      );

      await this.eventParticipantRepository.saveMany(
        input.events
          .map((event) => ({
            indexedEventId: indexedEventIdByKey.get(
              [event.contractId, event.txHash, event.logIndex.toString()].join("|")
            ),
            participants: event.participants
          }))
          .filter(
            (
              entry
            ): entry is {
              indexedEventId: string;
              participants: DecodedIndexedEvent["participants"];
            } => Boolean(entry.indexedEventId)
          ),
        tx
      );

      await this.syncStateRepository.advance(
        input.contractId,
        input.lastSyncedBlock,
        input.lastSyncedBlockHash,
        input.status,
        tx
      );

      return result;
    });
  }
}
