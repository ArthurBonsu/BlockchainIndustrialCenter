export interface CrossChainTransactionData {
  fromChain: string;
  toChain: string;
  amount: string;
  recipient: string;
}

export class CrossChainService {
  static async transfer(data: CrossChainTransactionData) {
    // Cross-chain logic (e.g., using Tatum or another bridge)
  }
}