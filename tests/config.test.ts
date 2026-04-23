import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("loads required configuration", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/blockchain_indexer",
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      HOST: "127.0.0.1",
      PORT: "3001",
      ETHEREUM_RPC_URL: "https://sepolia.example.com"
    });

    expect(config).toMatchObject({
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      HOST: "127.0.0.1",
      PORT: 3001
    });
  });

  it("fails when DATABASE_URL is missing", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("fails when DATABASE_URL does not use a postgres protocol", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "mysql://root:root@localhost:3306/blockchain_indexer",
        ETHEREUM_RPC_URL: "https://sepolia.example.com"
      })
    ).toThrow(/postgresql:\/\/ or postgres:\/\//);
  });

  it("fails fast when indexing is enabled with the placeholder RPC key", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/blockchain_indexer",
        ETHEREUM_RPC_URL: "https://sepolia.infura.io/v3/YOUR_API_KEY",
        INDEXER_ENABLED: "true"
      })
    ).toThrow(/YOUR_API_KEY/);
  });

  it("allows the placeholder RPC key when the indexer is explicitly disabled", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/blockchain_indexer",
      ETHEREUM_RPC_URL: "https://sepolia.infura.io/v3/YOUR_API_KEY",
      INDEXER_ENABLED: "false"
    });

    expect(config.INDEXER_ENABLED).toBe(false);
  });
});
