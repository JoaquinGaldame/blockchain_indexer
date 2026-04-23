import { describe, expect, it } from "vitest";
import { loadBootstrapContractsFromConfig } from "../src/modules/contracts/contractConfig.service.js";

describe("loadBootstrapContractsFromConfig", () => {
  it("loads configured contracts and normalizes addresses", () => {
    const contracts = loadBootstrapContractsFromConfig({
      CONTRACT_BOOTSTRAP_CONFIG: JSON.stringify([
        {
          name: "MyContract",
          address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          network: "sepolia",
          chainId: 11155111,
          abiPath: "src/contracts/abi/SampleErc20.json",
          startBlock: 123,
          isActive: true
        }
      ])
    });

    expect(contracts).toEqual([
      {
        name: "MyContract",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        network: "sepolia",
        chainId: 11155111,
        abiPath: "src/contracts/abi/SampleErc20.json",
        startBlock: 123n,
        isActive: true
      }
    ]);
  });

  it("provides a deterministic sample bootstrap contract by default", () => {
    const contracts = loadBootstrapContractsFromConfig({});

    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      name: "SampleErc20",
      network: "sepolia",
      chainId: 11155111,
      abiPath: "src/contracts/abi/SampleErc20.json",
      startBlock: 0n,
      isActive: true
    });
  });
});
