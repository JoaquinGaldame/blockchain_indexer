import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createLogger } from "../src/infrastructure/logger/logger.js";

describe("health routes", () => {
  it("returns liveness status", async () => {
    const app = await buildApp({
      logger: createLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      prisma: {
        $disconnect: vi.fn(),
        $queryRaw: vi.fn()
      } as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("returns readiness status when the database responds", async () => {
    const app = await buildApp({
      logger: createLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      prisma: {
        $disconnect: vi.fn(),
        $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }])
      } as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });

    await app.close();
  });
});
