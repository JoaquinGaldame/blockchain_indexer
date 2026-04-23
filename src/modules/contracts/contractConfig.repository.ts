import type { PrismaClient } from "@prisma/client";
import type { JsonValue } from "../../shared/types/json.js";
import type { ContractConfig, ContractEventConfig } from "./contractConfig.types.js";

interface UpsertContractInput {
  name: string;
  address: string;
  network: string;
  chainId: number;
  abiJson: JsonValue;
  startBlock: bigint;
  isActive: boolean;
}

export class ContractConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByNetwork(network: string): Promise<ContractConfig[]> {
    const contracts = await this.prisma.contract.findMany({
      where: {
        network,
        isActive: true
      },
      include: {
        contractEvents: {
          where: {
            isActive: true
          }
        }
      },
      orderBy: [{ name: "asc" }, { address: "asc" }]
    });

    return contracts.map((contract) => ({
      id: contract.id,
      name: contract.name,
      address: contract.address,
      network: contract.network,
      chainId: contract.chainId,
      abi: contract.abiJson,
      startBlock: contract.startBlock,
      isActive: contract.isActive,
      events: contract.contractEvents.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        topic0: event.topic0,
        isActive: event.isActive
      }))
    }));
  }

  async upsertContract(input: UpsertContractInput): Promise<ContractConfig> {
    const address = input.address.toLowerCase();

    const contract = await this.prisma.contract.upsert({
      where: {
        network_address: {
          network: input.network,
          address
        }
      },
      create: {
        name: input.name,
        address,
        network: input.network,
        chainId: input.chainId,
        abiJson: input.abiJson as never,
        startBlock: input.startBlock,
        isActive: input.isActive
      },
      update: {
        name: input.name,
        chainId: input.chainId,
        abiJson: input.abiJson as never,
        startBlock: input.startBlock,
        isActive: input.isActive,
        updatedAt: new Date()
      }
    });

    await this.prisma.syncState.upsert({
      where: {
        contractId: contract.id
      },
      create: {
        contractId: contract.id,
        lastSyncedBlock: input.startBlock,
        status: "IDLE"
      },
      update: {
        updatedAt: new Date()
      }
    });

    return {
      id: contract.id,
      name: contract.name,
      address: contract.address,
      network: contract.network,
      chainId: contract.chainId,
      abi: contract.abiJson,
      startBlock: contract.startBlock,
      isActive: contract.isActive,
      events: []
    };
  }

  async upsertContractEvents(
    contractId: string,
    events: Array<{ eventName: string; topic0: string }>
  ): Promise<ContractEventConfig[]> {
    return Promise.all(
      events.map(async (event) => {
        const contractEvent = await this.prisma.contractEvent.upsert({
          where: {
            contractId_eventName: {
              contractId,
              eventName: event.eventName
            }
          },
          create: {
            contractId,
            eventName: event.eventName,
            topic0: event.topic0.toLowerCase(),
            isActive: true
          },
          update: {
            topic0: event.topic0.toLowerCase(),
            isActive: true,
            updatedAt: new Date()
          }
        });

        return {
          id: contractEvent.id,
          eventName: contractEvent.eventName,
          topic0: contractEvent.topic0,
          isActive: contractEvent.isActive
        };
      })
    );
  }
}
