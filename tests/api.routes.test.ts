import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createLogger } from "../src/infrastructure/logger/logger.js";

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)),
    contract: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null)
    },
    indexedEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null)
    },
    syncState: {
      findMany: vi.fn().mockResolvedValue([])
    },
    ...overrides
  };
}

describe("api routes", () => {
  it("returns paginated contracts", async () => {
    const prisma = createMockPrisma({
      contract: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "SampleErc20",
            address: "0x0000000000000000000000000000000000000000",
            network: "sepolia",
            chainId: 11155111,
            abiJson: [],
            startBlock: 0n,
            isActive: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            contractEvents: [],
            syncState: null
          }
        ]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(null)
      }
    });
    const app = await buildApp({
      logger: createLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      prisma: prisma as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/contracts?page=1&limit=10"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        {
          name: "SampleErc20",
          startBlock: "0"
        }
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        hasNextPage: false
      }
    });

    await app.close();
  });

  it("validates event filters", async () => {
    const app = await buildApp({
      logger: createLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      prisma: createMockPrisma() as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/events?txHash=invalid"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "BAD_REQUEST"
      }
    });

    await app.close();
  });

  it("returns sync status", async () => {
    const prisma = createMockPrisma({
      syncState: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "33333333-3333-4333-8333-333333333333",
            contractId: "11111111-1111-4111-8111-111111111111",
            lastSyncedBlock: 10n,
            lastSyncedBlockHash: null,
            status: "LIVE",
            lastError: null,
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            contract: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "SampleErc20",
              address: "0x0000000000000000000000000000000000000000",
              network: "sepolia",
              chainId: 11155111
            }
          }
        ])
      }
    });
    const app = await buildApp({
      logger: createLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      prisma: prisma as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/sync-status"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        {
          lastSyncedBlock: "10",
          status: "LIVE"
        }
      ]
    });

    await app.close();
  });
});
