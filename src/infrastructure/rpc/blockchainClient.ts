import { JsonRpcProvider, type Filter, type Log } from "ethers";

export interface BlockReference {
  number: bigint;
  hash: string;
}

export interface BlockchainClient {
  getLatestBlockNumber(): Promise<bigint>;
  getBlockReference(blockNumber: bigint): Promise<BlockReference>;
  getLogs(filter: Filter): Promise<Log[]>;
  destroy(): void;
}

export class EthersBlockchainClient implements BlockchainClient {
  private readonly provider: JsonRpcProvider;

  constructor(rpcUrl: string, chainId?: number) {
    this.provider = new JsonRpcProvider(rpcUrl, chainId);
  }

  async getLatestBlockNumber(): Promise<bigint> {
    return BigInt(await this.provider.getBlockNumber());
  }

  async getBlockReference(blockNumber: bigint): Promise<BlockReference> {
    const block = await this.provider.getBlock(Number(blockNumber));

    if (!block?.hash) {
      throw new Error(`Block ${blockNumber.toString()} was not found by the RPC provider`);
    }

    return {
      number: BigInt(block.number),
      hash: block.hash
    };
  }

  async getLogs(filter: Filter): Promise<Log[]> {
    return this.provider.getLogs(filter);
  }

  destroy(): void {
    this.provider.destroy();
  }
}
