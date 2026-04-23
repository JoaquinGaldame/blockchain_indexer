import { describe, expect, it, vi } from "vitest";
import { IndexedEventRepository } from "../src/modules/events/indexedEvent.repository.js";

describe("IndexedEventRepository", () => {
  it("uses skipDuplicates so repeated blockchain logs are idempotent", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new IndexedEventRepository({
      indexedEvent: {
        createMany
      }
    } as never);

    await repository.saveMany([
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
        argsJson: ["1000"],
        decodedJson: { value: "1000" },
        participants: [],
        removed: false,
        processedAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true
      })
    );
  });
});
