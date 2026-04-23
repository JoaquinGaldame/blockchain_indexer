import { Interface } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { IndexerService } from "../src/modules/sync/indexer.service.js";

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

function createContract() {
  const iface = new Interface(abi);
  const transfer = iface.getEvent("Transfer");

  if (!transfer) {
    throw new Error("Transfer event not found");
  }

  return {
    contract: {
      id: "contract-1",
      name: "SampleErc20",
      address: "0x0000000000000000000000000000000000000000",
      network: "sepolia",
      chainId: 11155111,
      abi,
      startBlock: 10n,
      isActive: true,
      events: [
        {
          id: "event-config-1",
          eventName: "Transfer",
          topic0: transfer.topicHash.toLowerCase(),
          isActive: true
        }
      ]
    },
    iface,
    transfer
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

describe("IndexerService", () => {
  it("decodes realistic provider logs and persists normalized participants", async () => {
    const { contract, iface, transfer } = createContract();
    const encoded = iface.encodeEventLog(transfer, [
      "0x00000000000000000000000000000000000000AA",
      "0x00000000000000000000000000000000000000BB",
      1000n
    ]);
    const persistBatch = vi.fn().mockResolvedValue({
      attempted: 1,
      inserted: 1,
      duplicates: 0
    });
    const markSyncing = vi.fn().mockResolvedValue({});
    const markLive = vi.fn().mockResolvedValue({});
    const markError = vi.fn().mockResolvedValue({});
    const service = new IndexerService({
      config: {
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        HOST: "127.0.0.1",
        PORT: 3000,
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/blockchain_indexer",
        ETHEREUM_RPC_URL: "https://sepolia.example.com",
        INDEXER_NETWORK: "sepolia",
        INDEXER_ENABLED: true,
        INDEXER_BATCH_SIZE: 1000,
        INDEXER_CONFIRMATIONS: 2,
        INDEXER_POLL_INTERVAL_MS: 1000
      },
      blockchainClient: {
        getLatestBlockNumber: vi.fn().mockResolvedValue(12n),
        getBlockReference: vi.fn().mockResolvedValue({
          number: 10n,
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }),
        getLogs: vi.fn().mockResolvedValue([
          {
            address: contract.address,
            blockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            blockNumber: 10,
            data: encoded.data,
            index: 1,
            topics: encoded.topics,
            transactionHash:
              "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            transactionIndex: 0,
            removed: false
          }
        ]),
        destroy: vi.fn()
      },
      contractConfigService: {
        getActiveContracts: vi.fn().mockResolvedValue([contract])
      } as never,
      batchPersistenceService: {
        persistBatch
      } as never,
      syncStateRepository: {
        ensure: vi.fn().mockResolvedValue({
          contractId: contract.id,
          lastSyncedBlock: 9n,
          status: "IDLE"
        }),
        markSyncing,
        markLive,
        markError
      } as never,
      logger: createLogger() as never
    });

    Reflect.set(service, "stopped", false);
    await service.syncToSafeHead("LIVE");

    expect(markSyncing).toHaveBeenCalledWith("contract-1");
    expect(markLive).not.toHaveBeenCalled();
    expect(markError).not.toHaveBeenCalled();
    expect(persistBatch).toHaveBeenCalledTimes(1);
    const [batchInput] = persistBatch.mock.calls[0] as [
      {
        contractId: string;
        events: Array<{
          eventName: string;
          blockNumber: bigint;
          decodedJson: Record<string, unknown>;
          participants: Array<{
            network: string;
            address: string;
            role: string;
            argName: string | null;
          }>;
        }>;
        lastSyncedBlock: bigint;
        lastSyncedBlockHash: string;
        status: string;
      }
    ];

    expect(batchInput.contractId).toBe("contract-1");
    expect(batchInput.lastSyncedBlock).toBe(10n);
    expect(batchInput.lastSyncedBlockHash).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(batchInput.status).toBe("LIVE");
    expect(batchInput.events).toHaveLength(1);
    expect(batchInput.events[0]).toMatchObject({
      eventName: "Transfer",
      blockNumber: 10n,
      decodedJson: {
        from: "0x00000000000000000000000000000000000000AA",
        to: "0x00000000000000000000000000000000000000bb",
        value: "1000"
      },
      participants: [
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
      ]
    });
  });

  it("marks the contract as live when it is already caught up to the safe block", async () => {
    const { contract } = createContract();
    const markLive = vi.fn().mockResolvedValue({});
    const service = new IndexerService({
      config: {
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        HOST: "127.0.0.1",
        PORT: 3000,
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/blockchain_indexer",
        ETHEREUM_RPC_URL: "https://sepolia.example.com",
        INDEXER_NETWORK: "sepolia",
        INDEXER_ENABLED: true,
        INDEXER_BATCH_SIZE: 1000,
        INDEXER_CONFIRMATIONS: 2,
        INDEXER_POLL_INTERVAL_MS: 1000
      },
      blockchainClient: {
        getLatestBlockNumber: vi.fn().mockResolvedValue(12n),
        getBlockReference: vi.fn(),
        getLogs: vi.fn(),
        destroy: vi.fn()
      },
      contractConfigService: {
        getActiveContracts: vi.fn().mockResolvedValue([contract])
      } as never,
      batchPersistenceService: {
        persistBatch: vi.fn()
      } as never,
      syncStateRepository: {
        ensure: vi.fn().mockResolvedValue({
          contractId: contract.id,
          lastSyncedBlock: 10n,
          status: "SYNCING"
        }),
        markSyncing: vi.fn(),
        markLive,
        markError: vi.fn()
      } as never,
      logger: createLogger() as never
    });

    Reflect.set(service, "stopped", false);
    await service.syncToSafeHead("LIVE");

    expect(markLive).toHaveBeenCalledWith("contract-1");
  });

  it("marks sync state as error when batch persistence fails", async () => {
    const { contract, iface, transfer } = createContract();
    const encoded = iface.encodeEventLog(transfer, [
      "0x00000000000000000000000000000000000000AA",
      "0x00000000000000000000000000000000000000BB",
      1000n
    ]);
    const markError = vi.fn().mockResolvedValue({});
    const service = new IndexerService({
      config: {
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        HOST: "127.0.0.1",
        PORT: 3000,
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/blockchain_indexer",
        ETHEREUM_RPC_URL: "https://sepolia.example.com",
        INDEXER_NETWORK: "sepolia",
        INDEXER_ENABLED: true,
        INDEXER_BATCH_SIZE: 1000,
        INDEXER_CONFIRMATIONS: 2,
        INDEXER_POLL_INTERVAL_MS: 1000
      },
      blockchainClient: {
        getLatestBlockNumber: vi.fn().mockResolvedValue(12n),
        getBlockReference: vi.fn().mockResolvedValue({
          number: 10n,
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }),
        getLogs: vi.fn().mockResolvedValue([
          {
            address: contract.address,
            blockHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            blockNumber: 10,
            data: encoded.data,
            index: 1,
            topics: encoded.topics,
            transactionHash:
              "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            transactionIndex: 0,
            removed: false
          }
        ]),
        destroy: vi.fn()
      },
      contractConfigService: {
        getActiveContracts: vi.fn().mockResolvedValue([contract])
      } as never,
      batchPersistenceService: {
        persistBatch: vi.fn().mockRejectedValue(new Error("insert failed"))
      } as never,
      syncStateRepository: {
        ensure: vi.fn().mockResolvedValue({
          contractId: contract.id,
          lastSyncedBlock: 9n,
          status: "IDLE"
        }),
        markSyncing: vi.fn().mockResolvedValue({}),
        markLive: vi.fn(),
        markError
      } as never,
      logger: createLogger() as never
    });

    Reflect.set(service, "stopped", false);
    await service.syncToSafeHead("LIVE");

    expect(markError).toHaveBeenCalledWith("contract-1", expect.any(Error));
  });
});
