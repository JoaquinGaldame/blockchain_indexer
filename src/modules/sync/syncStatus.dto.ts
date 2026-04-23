import type { SyncState } from "@prisma/client";

type SyncStateWithContract = SyncState & {
  contract: {
    id: string;
    name: string;
    address: string;
    network: string;
    chainId: number;
  };
};

export function serializeSyncStatus(syncState: SyncStateWithContract) {
  return {
    id: syncState.id,
    contractId: syncState.contractId,
    lastSyncedBlock: syncState.lastSyncedBlock.toString(),
    lastSyncedBlockHash: syncState.lastSyncedBlockHash,
    status: syncState.status,
    lastError: syncState.lastError,
    updatedAt: syncState.updatedAt.toISOString(),
    contract: syncState.contract
  };
}
