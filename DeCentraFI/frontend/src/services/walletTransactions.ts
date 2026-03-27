export interface BrowserWalletTransaction {
  txHash: string;
  chainId: number;
  from?: string;
  to?: string;
  valueWei?: string;
  gasUsedWei?: string;
  effectiveGasPriceWei?: string;
  blockNumber?: string;
  status: "success" | "reverted" | "pending";
  capturedAtIso: string;
}

const WALLET_TX_STORAGE_KEY = "decentrafi_wallet_transactions";
const MAX_STORED_TXS = 100;

function readStoredTransactions(): BrowserWalletTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WALLET_TX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrowserWalletTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredTransactions(list: BrowserWalletTransaction[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WALLET_TX_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_STORED_TXS)));
}

export function recordWalletTransaction(tx: BrowserWalletTransaction): void {
  const existing = readStoredTransactions();
  const withoutSameHash = existing.filter((item) => item.txHash.toLowerCase() !== tx.txHash.toLowerCase());
  writeStoredTransactions([tx, ...withoutSameHash]);
}

export function getStoredWalletTransactions(): BrowserWalletTransaction[] {
  return readStoredTransactions();
}

// Browser fields you should capture for every wallet tx.
export const REQUIRED_BROWSER_TX_FIELDS = [
  "txHash",
  "chainId",
  "from",
  "to",
  "valueWei",
  "status",
  "blockNumber",
  "gasUsedWei",
  "effectiveGasPriceWei",
] as const;

