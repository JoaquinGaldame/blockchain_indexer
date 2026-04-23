import type { Prisma, PrismaClient } from "@prisma/client";
import type { DecodedIndexedEvent } from "./indexedEvent.types.js";
import { getPagination, type PaginationInput } from "../../shared/utils/pagination.js";

export interface SaveIndexedEventsResult {
  inserted: number;
  duplicates: number;
  attempted: number;
}

export interface IndexedEventIdentity {
  id: string;
  contractId: string;
  txHash: string;
  logIndex: number;
}

type PrismaTransaction = Prisma.TransactionClient | PrismaClient;

export class IndexedEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(filters: IndexedEventFilters, pagination: PaginationInput) {
    const where = this.buildWhere(filters);
    const { take, skip } = getPagination(pagination);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.indexedEvent.findMany({
        where,
        include: indexedEventIncludes,
        orderBy: [{ blockNumber: "desc" }, { logIndex: "desc" }],
        take,
        skip
      }),
      this.prisma.indexedEvent.count({ where })
    ]);

    return { items, total };
  }

  async findById(id: string) {
    return this.prisma.indexedEvent.findUnique({
      where: { id },
      include: indexedEventIncludes
    });
  }

  async saveMany(
    events: DecodedIndexedEvent[],
    client: PrismaTransaction = this.prisma
  ): Promise<SaveIndexedEventsResult> {
    if (events.length === 0) {
      return { inserted: 0, duplicates: 0, attempted: 0 };
    }

    const result = await client.indexedEvent.createMany({
      data: events.map((event) => ({
        contractId: event.contractId,
        contractEventId: event.contractEventId,
        eventName: event.eventName,
        txHash: event.txHash,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
        transactionIndex: event.transactionIndex,
        contractAddress: event.contractAddress,
        argsJson: event.argsJson as never,
        decodedJson: event.decodedJson as never,
        // Participants are persisted separately because wallet normalization
        // and event relations require indexed event ids from the database.
        removed: event.removed,
        processedAt: event.processedAt
      })),
      skipDuplicates: true
    });

    return {
      inserted: result.count,
      duplicates: events.length - result.count,
      attempted: events.length
    };
  }

  async findManyByUniqueKeys(
    keys: Array<{ contractId: string; txHash: string; logIndex: number }>,
    client: PrismaTransaction = this.prisma
  ): Promise<IndexedEventIdentity[]> {
    if (keys.length === 0) {
      return [];
    }

    return client.indexedEvent.findMany({
      where: {
        OR: keys.map((key) => ({
          contractId: key.contractId,
          txHash: key.txHash,
          logIndex: key.logIndex
        }))
      },
      select: {
        id: true,
        contractId: true,
        txHash: true,
        logIndex: true
      }
    });
  }

  private buildWhere(filters: IndexedEventFilters): Prisma.IndexedEventWhereInput {
    const walletAddress = filters.walletAddress?.toLowerCase();

    return {
      ...(filters.contractAddress ? { contractAddress: filters.contractAddress.toLowerCase() } : {}),
      ...(filters.eventName ? { eventName: filters.eventName } : {}),
      ...(filters.txHash ? { txHash: filters.txHash.toLowerCase() } : {}),
      ...(filters.fromBlock || filters.toBlock
        ? {
            blockNumber: {
              ...(filters.fromBlock ? { gte: filters.fromBlock } : {}),
              ...(filters.toBlock ? { lte: filters.toBlock } : {})
            }
          }
        : {}),
      ...(walletAddress
        ? {
            OR: [
              {
                participants: {
                  some: {
                    walletAddress: {
                      address: walletAddress
                    }
                  }
                }
              },
              {
                decodedJson: {
                  path: ["from"],
                  equals: walletAddress
                }
              },
              {
                decodedJson: {
                  path: ["to"],
                  equals: walletAddress
                }
              },
              {
                decodedJson: {
                  path: ["owner"],
                  equals: walletAddress
                }
              },
              {
                decodedJson: {
                  path: ["spender"],
                  equals: walletAddress
                }
              }
            ]
          }
        : {})
    };
  }
}

export interface IndexedEventFilters {
  contractAddress?: string;
  eventName?: string;
  txHash?: string;
  walletAddress?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
}

const indexedEventIncludes = {
  contract: true,
  contractEvent: true,
  participants: {
    include: {
      walletAddress: true
    }
  }
} satisfies Prisma.IndexedEventInclude;
