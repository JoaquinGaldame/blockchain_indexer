import type { Prisma, PrismaClient, SyncStatus } from "@prisma/client";
import type { ContractConfig } from "../contracts/contractConfig.types.js";

type PrismaTransaction = Prisma.TransactionClient | PrismaClient;

export class SyncStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensure(contract: ContractConfig) {
    return this.prisma.syncState.upsert({
      where: {
        contractId: contract.id
      },
      create: {
        contractId: contract.id,
        lastSyncedBlock: contract.startBlock > 0n ? contract.startBlock - 1n : 0n,
        status: "IDLE"
      },
      update: {}
    });
  }

  async markSyncing(contractId: string) {
    return this.prisma.syncState.update({
      where: { contractId },
      data: {
        status: "SYNCING",
        lastError: null,
        updatedAt: new Date()
      }
    });
  }

  async advance(
    contractId: string,
    lastSyncedBlock: bigint,
    lastSyncedBlockHash: string,
    status: SyncStatus,
    client: PrismaTransaction = this.prisma
  ) {
    return client.syncState.update({
      where: { contractId },
      data: {
        lastSyncedBlock,
        lastSyncedBlockHash,
        status,
        lastError: null,
        updatedAt: new Date()
      }
    });
  }

  async markLive(contractId: string) {
    return this.prisma.syncState.update({
      where: { contractId },
      data: {
        status: "LIVE",
        lastError: null,
        updatedAt: new Date()
      }
    });
  }

  async markError(contractId: string, error: unknown) {
    return this.prisma.syncState.update({
      where: { contractId },
      data: {
        status: "ERROR",
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date()
      }
    });
  }

  async findAll() {
    return this.prisma.syncState.findMany({
      include: {
        contract: {
          select: {
            id: true,
            name: true,
            address: true,
            network: true,
            chainId: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });
  }
}
