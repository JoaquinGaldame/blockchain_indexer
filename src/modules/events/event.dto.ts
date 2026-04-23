import type { Contract, ContractEvent, EventParticipant, IndexedEvent, WalletAddress } from "@prisma/client";

type IndexedEventWithRelations = IndexedEvent & {
  contract?: Contract;
  contractEvent?: ContractEvent | null;
  participants?: Array<EventParticipant & { walletAddress: WalletAddress }>;
};

export function serializeIndexedEvent(event: IndexedEventWithRelations) {
  return {
    id: event.id,
    contractId: event.contractId,
    contractEventId: event.contractEventId,
    eventName: event.eventName,
    txHash: event.txHash,
    blockNumber: event.blockNumber.toString(),
    blockHash: event.blockHash,
    logIndex: event.logIndex,
    transactionIndex: event.transactionIndex,
    contractAddress: event.contractAddress,
    args: event.argsJson,
    decoded: event.decodedJson,
    removed: event.removed,
    processedAt: event.processedAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    contract: event.contract
      ? {
          id: event.contract.id,
          name: event.contract.name,
          address: event.contract.address,
          network: event.contract.network
        }
      : undefined,
    contractEvent: event.contractEvent
      ? {
          id: event.contractEvent.id,
          eventName: event.contractEvent.eventName,
          topic0: event.contractEvent.topic0
        }
      : undefined,
    participants:
      event.participants?.map((participant) => ({
        id: participant.id,
        role: participant.role,
        argName: participant.argName,
        address: participant.walletAddress.address,
        network: participant.walletAddress.network
      })) ?? undefined
  };
}
