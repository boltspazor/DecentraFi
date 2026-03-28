import { sepolia } from "wagmi/chains";

/** Human-readable native unit for UI (contracts still use wei). */
export function nativeCurrencyLabel(chainId: number | undefined): string {
  if (chainId === sepolia.id) return "Sepolia ETH";
  if (chainId === 1) return "ETH";
  return "ETH";
}

export function isSepoliaChain(chainId: number | undefined): boolean {
  return chainId === sepolia.id;
}
