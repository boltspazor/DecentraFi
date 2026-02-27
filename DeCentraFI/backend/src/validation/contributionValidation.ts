/**
 * Validation for contribution metadata (blockchain-confirmed only).
 */

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const WEI_REGEX = /^\d+$/;

export function validateContributionBody(body: {
  campaignId?: unknown;
  contributorAddress?: unknown;
  amountWei?: unknown;
  txHash?: unknown;
}): { valid: true; data: { campaignId: number; contributorAddress: string; amountWei: string; txHash: string } } | { valid: false; statusCode: number; error: string } {
  const cId = body.campaignId;
  if (cId === undefined || cId === null) {
    return { valid: false, statusCode: 400, error: "campaignId is required" };
  }
  const campaignId = typeof cId === "string" ? parseInt(cId, 10) : Number(cId);
  if (Number.isNaN(campaignId) || campaignId < 1) {
    return { valid: false, statusCode: 400, error: "Invalid campaignId" };
  }

  const addr = body.contributorAddress;
  if (typeof addr !== "string" || !addr.trim()) {
    return { valid: false, statusCode: 400, error: "contributorAddress is required" };
  }
  const contributorAddress = addr.trim();
  if (!ETH_ADDRESS_REGEX.test(contributorAddress)) {
    return { valid: false, statusCode: 400, error: "Invalid contributorAddress" };
  }

  const amount = body.amountWei;
  if (amount === undefined || amount === null) {
    return { valid: false, statusCode: 400, error: "amountWei is required" };
  }
  const amountWei = String(amount).trim();
  if (!WEI_REGEX.test(amountWei) || BigInt(amountWei) <= 0n) {
    return { valid: false, statusCode: 400, error: "amountWei must be a positive integer" };
  }

  const txHash = body.txHash;
  if (typeof txHash !== "string" || !txHash.trim()) {
    return { valid: false, statusCode: 400, error: "txHash is required" };
  }
  const txHashVal = txHash.trim();
  if (!TX_HASH_REGEX.test(txHashVal)) {
    return { valid: false, statusCode: 400, error: "Invalid txHash" };
  }

  return {
    valid: true,
    data: {
      campaignId,
      contributorAddress: contributorAddress.toLowerCase(),
      amountWei,
      txHash: txHashVal,
    },
  };
}

export function validatePatchStatusBody(body: { status?: unknown }): { valid: true; status: string } | { valid: false; statusCode: number; error: string } {
  const s = body.status;
  if (typeof s !== "string" || !s.trim()) {
    return { valid: false, statusCode: 400, error: "status is required" };
  }
  const status = s.trim();
  if (!["Active", "Successful", "Failed"].includes(status)) {
    return { valid: false, statusCode: 400, error: "status must be Active, Successful, or Failed" };
  }
  return { valid: true, status };
}
