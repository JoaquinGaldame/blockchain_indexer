import type { Prisma } from "@prisma/client";

export interface ContractConfig {
  id: string;
  name: string;
  address: string;
  network: string;
  chainId: number;
  abi: Prisma.JsonValue;
  startBlock: bigint;
  isActive: boolean;
  events: ContractEventConfig[];
}

export interface ContractEventConfig {
  id: string;
  eventName: string;
  topic0: string | null;
  isActive: boolean;
}

export interface ContractBootstrapInput {
  name: string;
  address: string;
  network: string;
  chainId: number;
  abiPath: string;
  startBlock: bigint;
  isActive: boolean;
}
