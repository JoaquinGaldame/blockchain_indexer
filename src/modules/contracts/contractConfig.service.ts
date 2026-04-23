import { readFile } from "node:fs/promises";
import path from "node:path";
import { Interface, type InterfaceAbi } from "ethers";
import { z } from "zod";
import type { JsonValue } from "../../shared/types/json.js";
import type { ContractBootstrapInput, ContractConfig } from "./contractConfig.types.js";
import type { ContractConfigRepository } from "./contractConfig.repository.js";

const abiSchema = z.array(z.record(z.unknown())).min(1);

const bootstrapContractSchema = z.object({
  name: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.string().min(1).default("sepolia"),
  chainId: z.coerce.number().int().positive().default(11155111),
  abiPath: z.string().min(1),
  startBlock: z.coerce.bigint().refine((value) => value >= 0n),
  isActive: z.boolean().default(true)
});

export class ContractConfigService {
  constructor(private readonly repository: ContractConfigRepository) {}

  async getActiveContracts(network = "sepolia"): Promise<ContractConfig[]> {
    return this.repository.findActiveByNetwork(network);
  }

  async bootstrapContracts(inputs: ContractBootstrapInput[]): Promise<ContractConfig[]> {
    const contracts = [];

    for (const input of inputs) {
      const abi = await this.loadAbi(input.abiPath);
      const contract = await this.repository.upsertContract({
        name: input.name,
        address: input.address,
        network: input.network,
        chainId: input.chainId,
        abiJson: abi,
        startBlock: input.startBlock,
        isActive: input.isActive
      });
      const events = await this.repository.upsertContractEvents(
        contract.id,
        this.extractEventsFromAbi(abi)
      );

      contracts.push({
        ...contract,
        events
      });
    }

    return contracts;
  }

  private async loadAbi(abiPath: string): Promise<JsonValue> {
    const resolvedPath = path.resolve(process.cwd(), abiPath);
    const rawAbi = await readFile(resolvedPath, "utf8");

    return abiSchema.parse(JSON.parse(rawAbi)) as JsonValue;
  }

  private extractEventsFromAbi(abi: JsonValue): Array<{ eventName: string; topic0: string }> {
    const iface = new Interface(abi as InterfaceAbi);
    const events: Array<{ eventName: string; topic0: string }> = [];

    iface.forEachEvent((event) => {
      events.push({
        eventName: event.name,
        topic0: event.topicHash.toLowerCase()
      });
    });

    return events;
  }
}

export function loadBootstrapContractsFromConfig(config: {
  CONTRACT_BOOTSTRAP_CONFIG?: string;
}): ContractBootstrapInput[] {
  const rawConfig = config.CONTRACT_BOOTSTRAP_CONFIG;

  if (!rawConfig) {
    return [
      {
        name: "SampleErc20",
        address: "0x0000000000000000000000000000000000000000",
        network: "sepolia",
        chainId: 11155111,
        abiPath: "src/contracts/abi/SampleErc20.json",
        startBlock: 0n,
        isActive: true
      }
    ];
  }

  const parsed = z.array(bootstrapContractSchema).min(1).parse(JSON.parse(rawConfig));

  return parsed.map((contract) => ({
    ...contract,
    address: contract.address.toLowerCase()
  }));
}
