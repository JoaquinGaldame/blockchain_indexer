import { describe, expect, it, vi } from "vitest";
import { SyncStateRepository } from "../src/modules/sync/syncState.repository.js";

describe("SyncStateRepository", () => {
  it("initializes sync state from the block before contract start", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prismaMock = {
      syncState: { upsert }
    };
    const repository = new SyncStateRepository(prismaMock as never);

    await repository.ensure({
      id: "contract-1",
      name: "Sample",
      address: "0x0000000000000000000000000000000000000000",
      network: "sepolia",
      chainId: 11155111,
      abi: [],
      startBlock: 55n,
      isActive: true,
      events: []
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { contractId: "contract-1" },
      create: {
        contractId: "contract-1",
        lastSyncedBlock: 54n,
        status: "IDLE"
      },
      update: {}
    });
  });

  it("advances sync state with the provided transaction client", async () => {
    const txUpdate = vi.fn().mockResolvedValue({});
    const prismaMock = { syncState: { update: vi.fn() } };
    const txClient = { syncState: { update: txUpdate } };
    const repository = new SyncStateRepository(prismaMock as never);

    await repository.advance(
      "contract-1",
      99n,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "LIVE",
      txClient as never
    );

    expect(txUpdate).toHaveBeenCalledTimes(1);
    const [advanceInput] = txUpdate.mock.calls[0] as [
      {
        where: { contractId: string };
        data: {
          lastSyncedBlock: bigint;
          lastSyncedBlockHash: string;
          status: string;
          lastError: null;
          updatedAt: Date;
        };
      }
    ];

    expect(advanceInput.where).toEqual({ contractId: "contract-1" });
    expect(advanceInput.data.lastSyncedBlock).toBe(99n);
    expect(advanceInput.data.lastSyncedBlockHash).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(advanceInput.data.status).toBe("LIVE");
    expect(advanceInput.data.lastError).toBeNull();
    expect(advanceInput.data.updatedAt).toBeInstanceOf(Date);
  });

  it("stores human-readable failures when marking error state", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prismaMock = {
      syncState: { update }
    };
    const repository = new SyncStateRepository(prismaMock as never);

    await repository.markError("contract-1", new Error("RPC timeout"));

    expect(update).toHaveBeenCalledTimes(1);
    const [errorInput] = update.mock.calls[0] as [
      {
        where: { contractId: string };
        data: {
          status: string;
          lastError: string;
          updatedAt: Date;
        };
      }
    ];

    expect(errorInput.where).toEqual({ contractId: "contract-1" });
    expect(errorInput.data.status).toBe("ERROR");
    expect(errorInput.data.lastError).toBe("RPC timeout");
    expect(errorInput.data.updatedAt).toBeInstanceOf(Date);
  });
});
