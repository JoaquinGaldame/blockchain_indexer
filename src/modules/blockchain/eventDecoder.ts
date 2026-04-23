import { Interface, type InterfaceAbi, type Log } from "ethers";
import type { JsonValue } from "../../shared/types/json.js";
import { extractEventParticipants } from "./eventParticipantExtractor.js";
import { normalizeEventValue } from "./eventValueNormalizer.js";
import type { ContractConfig } from "../contracts/contractConfig.types.js";
import type { DecodedIndexedEvent } from "../events/indexedEvent.types.js";

export class EventDecoder {
  private readonly iface: Interface;
  private readonly eventByTopic0: Map<string, string>;

  constructor(private readonly contract: ContractConfig) {
    this.iface = new Interface(contract.abi as InterfaceAbi);
    this.eventByTopic0 = new Map(
      contract.events
        .filter((event) => event.topic0)
        .map((event) => [event.topic0!.toLowerCase(), event.id])
    );
  }

  decode(log: Log): DecodedIndexedEvent | null {
    const parsed = (() => {
      try {
        return this.iface.parseLog({
          topics: [...log.topics],
          data: log.data
        });
      } catch {
        return null;
      }
    })();

    if (!parsed) {
      return null;
    }

    const decodedObject = Object.fromEntries(
      parsed.fragment.inputs.map((input, index) => [
        input.name || index.toString(),
        normalizeEventValue(parsed.args[index])
      ])
    );

    return {
      contractId: this.contract.id,
      contractEventId: this.eventByTopic0.get(log.topics[0]?.toLowerCase() ?? "") ?? null,
      eventName: parsed.name,
      txHash: log.transactionHash.toLowerCase(),
      blockNumber: BigInt(log.blockNumber),
      blockHash: log.blockHash.toLowerCase(),
      logIndex: log.index,
      transactionIndex: log.transactionIndex ?? null,
      contractAddress: log.address.toLowerCase(),
      argsJson: normalizeEventValue([...parsed.args]),
      decodedJson: decodedObject as JsonValue,
      participants: extractEventParticipants(
        this.contract.network,
        parsed.fragment.inputs,
        [...parsed.args]
      ),
      removed: log.removed,
      processedAt: new Date()
    };
  }
}
