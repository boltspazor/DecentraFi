/** Block explorer base URL for transaction links by chain id. */
export function getBlockExplorerTxUrl(chainId: number, txHash: string): string {
  const base = getBlockExplorerBase(chainId);
  return `${base}/tx/${txHash}`;
}

function getBlockExplorerBase(chainId: number): string {
  switch (chainId) {
    case 1:
      return "https://etherscan.io";
    case 137:
      return "https://polygonscan.com";
    case 42161:
      return "https://arbiscan.io";
    case 11155111:
      return "https://sepolia.etherscan.io";
    default:
      return "https://etherscan.io";
  }
}
