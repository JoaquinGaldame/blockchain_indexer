import { describe, expect, it, vi } from "vitest";
import { BatchPersistenceService } from "../src/modules/sync/batchPersistence.service.js";

describe("BatchPersistenceService", () => {
  it("persists events, participants and sync state in one transaction", async () => {
    const tx = {};
    const transaction = vi.fn(async (handler: (client: unknown) => Promise<unknown>) => handler(tx));
    const saveMany = vi.fn().mockResolvedValue({ attempted: 2, inserted: 1, duplicates: 1 });
    const findManyByUniqueKeys = vi.fn().mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        contractId: "11111111-1111-4111-8111-111111111111",
        txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        logIndex: 1
      }
    ]);
    const saveParticipants = vi.fn().mockResolvedValue(undefined);
    const advance = vi.fn().mockResolvedValue({});
    const service = new BatchPersistenceService(
      { $transaction: transaction } as never,
      { saveMany, findManyByUniqueKeys } as never,
      { saveMany: saveParticipants } as never,
      { advance } as never
    );

    const result = await service.persistBatch({
      contractId: "11111111-1111-4111-8111-111111111111",
      events: [
        {
          contractId: "11111111-1111-4111-8111-111111111111",
          contractEventId: null,
          eventName: "Transfer",
          txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          blockNumber: 123n,
          blockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          logIndex: 1,
          transactionIndex: 0,
          contractAddress: "0x0000000000000000000000000000000000000000",
          argsJson: ["0x0000000000000000000000000000000000000001"],
          decodedJson: { from: "0x0000000000000000000000000000000000000001" },
          participants: [
            {
              network: "sepolia",
              address: "0x0000000000000000000000000000000000000001",
              role: "from",
              argName: "from"
            }
          ],
          removed: false,
          processedAt: new Date("2026-01-01T00:00:00.000Z")
        }
      ],
      lastSyncedBlock: 123n,
      lastSyncedBlockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "LIVE"
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(saveMany).toHaveBeenCalledWith(expect.any(Array), tx);
    expect(findManyByUniqueKeys).toHaveBeenCalledWith(
      [
        {
          contractId: "11111111-1111-4111-8111-111111111111",
          txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          logIndex: 1
        }
      ],
      tx
    );
    expect(saveParticipants).toHaveBeenCalledWith(
      [
        {
          indexedEventId: "44444444-4444-4444-8444-444444444444",
          participants: [
            {
              network: "sepolia",
              address: "0x0000000000000000000000000000000000000001",
              role: "from",
              argName: "from"
            }
          ]
        }
      ],
      tx
    );
    expect(advance).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      123n,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "LIVE",
      tx
    );
    expect(result).toEqual({ attempted: 2, inserted: 1, duplicates: 1 });
  });
});
