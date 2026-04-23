import { Interface, type Log } from "ethers";
import { describe, expect, it } from "vitest";
import { EventDecoder } from "../src/modules/blockchain/eventDecoder.js";

const abi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" }
    ],
    name: "Transfer",
    type: "event"
  }
];

describe("EventDecoder", () => {
  it("decodes logs into JSON-safe indexed events", () => {
    const iface = new Interface(abi);
    const transfer = iface.getEvent("Transfer");

    if (!transfer) {
      throw new Error("Transfer event was not found in test ABI");
    }

    const encoded = iface.encodeEventLog(transfer, [
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
      1000n
    ]);
    const decoder = new EventDecoder({
      id: "11111111-1111-4111-8111-111111111111",
      name: "SampleErc20",
      address: "0x0000000000000000000000000000000000000000",
      network: "sepolia",
      chainId: 11155111,
      abi,
      startBlock: 0n,
      isActive: true,
      events: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          eventName: "Transfer",
          topic0: transfer.topicHash.toLowerCase(),
          isActive: true
        }
      ]
    });

    const decoded = decoder.decode({
      address: "0x0000000000000000000000000000000000000000",
      blockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      blockNumber: 123,
      data: encoded.data,
      index: 4,
      topics: encoded.topics,
      transactionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      transactionIndex: 2,
      removed: false
    } as unknown as Log);

    expect(decoded).toMatchObject({
      contractId: "11111111-1111-4111-8111-111111111111",
      contractEventId: "22222222-2222-4222-8222-222222222222",
      eventName: "Transfer",
      blockNumber: 123n,
      logIndex: 4,
      decodedJson: {
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        value: "1000"
      },
      participants: [
        {
          network: "sepolia",
          address: "0x0000000000000000000000000000000000000001",
          role: "from",
          argName: "from"
        },
        {
          network: "sepolia",
          address: "0x0000000000000000000000000000000000000002",
          role: "to",
          argName: "to"
        }
      ]
    });
  });
});
