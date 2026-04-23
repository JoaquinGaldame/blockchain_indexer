import { describe, expect, it, vi } from "vitest";
import { EventParticipantRepository } from "../src/modules/events/eventParticipant.repository.js";

describe("EventParticipantRepository", () => {
  it("persists unique wallets, refreshes lastSeenAt and skips duplicate participant edges", async () => {
    const walletCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const walletFindMany = vi.fn().mockResolvedValue([
      {
        id: "wallet-1",
        network: "sepolia",
        address: "0x0000000000000000000000000000000000000001"
      },
      {
        id: "wallet-2",
        network: "sepolia",
        address: "0x0000000000000000000000000000000000000002"
      }
    ]);
    const walletUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const participantCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prismaMock = {
      walletAddress: {
        createMany: walletCreateMany,
        findMany: walletFindMany,
        updateMany: walletUpdateMany
      },
      eventParticipant: {
        createMany: participantCreateMany
      }
    };
    const repository = new EventParticipantRepository(prismaMock as never);

    await repository.saveMany([
      {
        indexedEventId: "event-1",
        participants: [
          {
            network: "sepolia",
            address: "0x0000000000000000000000000000000000000001",
            role: "from",
            argName: "from"
          },
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
      }
    ]);

    expect(walletCreateMany).toHaveBeenCalledTimes(1);
    const [walletCreateInput] = walletCreateMany.mock.calls[0] as [
      {
        data: Array<{ network: string; address: string }>;
        skipDuplicates: boolean;
      }
    ];

    expect(walletCreateInput.skipDuplicates).toBe(true);
    expect(walletCreateInput.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          network: "sepolia",
          address: "0x0000000000000000000000000000000000000001"
        }),
        expect.objectContaining({
          network: "sepolia",
          address: "0x0000000000000000000000000000000000000002"
        })
      ])
    );
    expect(walletFindMany).toHaveBeenCalledTimes(1);
    expect(walletUpdateMany).toHaveBeenCalledTimes(1);
    expect(participantCreateMany).toHaveBeenCalledWith({
      data: [
        {
          indexedEventId: "event-1",
          walletAddressId: "wallet-1",
          role: "from",
          argName: "from"
        },
        {
          indexedEventId: "event-1",
          walletAddressId: "wallet-2",
          role: "to",
          argName: "to"
        }
      ],
      skipDuplicates: true
    });
  });
});
