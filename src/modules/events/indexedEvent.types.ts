import type { JsonValue } from "../../shared/types/json.js";

export interface ExtractedEventParticipant {
  network: string;
  address: string;
  role: string;
  argName: string | null;
}

export interface DecodedIndexedEvent {
  contractId: string;
  contractEventId: string | null;
  eventName: string;
  txHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
  transactionIndex: number | null;
  contractAddress: string;
  argsJson: JsonValue;
  decodedJson: JsonValue;
  participants: ExtractedEventParticipant[];
  removed: boolean;
  processedAt: Date;
}
