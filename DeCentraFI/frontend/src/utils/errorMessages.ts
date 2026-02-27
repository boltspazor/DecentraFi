/**
 * Map blockchain/wallet errors to user-friendly messages.
 */

export function getTransactionErrorMessage(error: unknown): string {
  if (!error) return "Transaction failed";
  const e = error as { message?: string; shortMessage?: string; code?: string; cause?: unknown };
  const msg = e.shortMessage ?? e.message ?? String(e);

  if (e.code === "ACTION_REJECTED" || msg.includes("User rejected") || msg.includes("user rejected")) {
    return "You rejected the transaction in your wallet.";
  }
  if (msg.includes("gas") || msg.includes("estimation") || msg.includes("revert")) {
    return "Transaction would fail (e.g. invalid parameters). Check goal and deadline.";
  }
  if (msg.includes("InvalidGoal")) {
    return "Goal must be greater than zero.";
  }
  if (msg.includes("InvalidDeadline")) {
    return "Deadline must be in the future.";
  }
  if (msg.includes("network") || msg.includes("chain")) {
    return "Network error. Please switch to Sepolia and try again.";
  }
  if (msg.length > 200) {
    return "Transaction failed. Check your wallet and network.";
  }
  return msg;
}

export function getConnectionErrorMessage(error: unknown): string {
  if (!error) return "Connection failed";
  const e = error as { message?: string; shortMessage?: string };
  const msg = e.shortMessage ?? e.message ?? String(e);
  if (msg.includes("rejected") || msg.includes("User denied")) {
    return "You rejected the connection request.";
  }
  if (msg.includes("No Ethereum provider")) {
    return "No wallet found. Install MetaMask or use a Web3-enabled browser.";
  }
  return msg.length > 150 ? "Connection failed. Try again or use another wallet." : msg;
}
