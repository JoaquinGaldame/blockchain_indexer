import type { Contract, ContractEvent, SyncState } from "@prisma/client";

export function serializeContract(
  contract: Contract & { contractEvents?: ContractEvent[]; syncState?: SyncState | null }
) {
  return {
    id: contract.id,
    name: contract.name,
    address: contract.address,
    network: contract.network,
    chainId: contract.chainId,
    startBlock: contract.startBlock.toString(),
    isActive: contract.isActive,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
    events:
      contract.contractEvents?.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        topic0: event.topic0,
        isActive: event.isActive,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString()
      })) ?? undefined,
    syncState: contract.syncState
      ? {
          id: contract.syncState.id,
          lastSyncedBlock: contract.syncState.lastSyncedBlock.toString(),
          lastSyncedBlockHash: contract.syncState.lastSyncedBlockHash,
          status: contract.syncState.status,
          lastError: contract.syncState.lastError,
          updatedAt: contract.syncState.updatedAt.toISOString()
        }
      : undefined
  };
}
