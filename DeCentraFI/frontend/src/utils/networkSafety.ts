function parseBool(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

export const CONFIGURED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? "") || 11155111;
export const ALLOW_MAINNET = parseBool(import.meta.env.VITE_ALLOW_MAINNET);

export function assertNetworkSafety(): void {
  if (!ALLOW_MAINNET && CONFIGURED_CHAIN_ID === 1) {
    throw new Error(
      "Safety check: VITE_CHAIN_ID=1 (mainnet) is blocked. Set VITE_ALLOW_MAINNET=true if you really want to use real ETH."
    );
  }
}

