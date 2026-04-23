import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { extractEventParticipants } from "../src/modules/blockchain/eventParticipantExtractor.js";

describe("extractEventParticipants", () => {
  it("extracts normalized addresses from direct event params", () => {
    const iface = new Interface([
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
    ]);
    const fragment = iface.getEvent("Transfer");

    if (!fragment) {
      throw new Error("Transfer event not found");
    }

    const participants = extractEventParticipants("sepolia", fragment.inputs, [
      "0x00000000000000000000000000000000000000AA",
      "0x00000000000000000000000000000000000000BB",
      10n
    ]);

    expect(participants).toEqual([
      {
        network: "sepolia",
        address: "0x00000000000000000000000000000000000000aa",
        role: "from",
        argName: "from"
      },
      {
        network: "sepolia",
        address: "0x00000000000000000000000000000000000000bb",
        role: "to",
        argName: "to"
      }
    ]);
  });

  it("walks arrays and tuples and deduplicates repeated addresses by path role", () => {
    const iface = new Interface([
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            name: "users",
            type: "tuple[]",
            components: [
              { name: "owner", type: "address" },
              { name: "recipient", type: "address" }
            ]
          }
        ],
        name: "BatchAssigned",
        type: "event"
      }
    ]);
    const fragment = iface.getEvent("BatchAssigned");

    if (!fragment) {
      throw new Error("BatchAssigned event not found");
    }

    const participants = extractEventParticipants("sepolia", fragment.inputs, [
      [
        {
          owner: "0x00000000000000000000000000000000000000AA",
          recipient: "0x00000000000000000000000000000000000000BB"
        },
        {
          owner: "0x00000000000000000000000000000000000000AA",
          recipient: "0x00000000000000000000000000000000000000CC"
        }
      ]
    ]);

    expect(participants).toEqual([
      {
        network: "sepolia",
        address: "0x00000000000000000000000000000000000000aa",
        role: "owner",
        argName: "users[0].owner"
      },
      {
        network: "sepolia",
        address: "0x00000000000000000000000000000000000000bb",
        role: "recipient",
        argName: "users[0].recipient"
      },
      {
        network: "sepolia",
        address: "0x00000000000000000000000000000000000000aa",
        role: "owner",
        argName: "users[1].owner"
      },
      {
        network: "sepolia",
        address: "0x00000000000000000000000000000000000000cc",
        role: "recipient",
        argName: "users[1].recipient"
      }
    ]);
  });
});
