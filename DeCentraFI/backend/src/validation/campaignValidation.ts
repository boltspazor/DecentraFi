/**
 * Validation helpers for campaign metadata. No private keys or sensitive data.
 */

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 5000;
const GOAL_MAX_LENGTH = 78; // uint256 as decimal string

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEthAddress(value: unknown): ValidationResult {
  if (typeof value !== "string" || !value.trim()) {
    return { valid: false, error: "Address is required" };
  }
  const v = value.trim();
  if (!ETH_ADDRESS_REGEX.test(v)) {
    return { valid: false, error: "Invalid Ethereum address format" };
  }
  return { valid: true };
}

export function validateTxHash(value: unknown): ValidationResult {
  if (value === undefined || value === null || value === "") {
    return { valid: true }; // optional
  }
  if (typeof value !== "string" || !value.trim()) {
    return { valid: true };
  }
  const v = value.trim();
  if (!TX_HASH_REGEX.test(v)) {
    return { valid: false, error: "Invalid transaction hash format" };
  }
  return { valid: true };
}

export function validateTitle(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { valid: false, error: "Title must be a string" };
  }
  const v = value.trim();
  if (v.length === 0) {
    return { valid: false, error: "Title is required" };
  }
  if (v.length > TITLE_MAX_LENGTH) {
    return { valid: false, error: `Title must be at most ${TITLE_MAX_LENGTH} characters` };
  }
  return { valid: true };
}

export function validateDescription(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { valid: false, error: "Description must be a string" };
  }
  const v = value.trim();
  if (v.length === 0) {
    return { valid: false, error: "Description is required" };
  }
  if (v.length > DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters` };
  }
  return { valid: true };
}

export function validateGoal(value: unknown): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: "Goal is required" };
  }
  const v = String(value).trim();
  if (v.length === 0) {
    return { valid: false, error: "Goal is required" };
  }
  if (v.length > GOAL_MAX_LENGTH) {
    return { valid: false, error: "Goal value too long" };
  }
  if (!/^\d+$/.test(v)) {
    return { valid: false, error: "Goal must be a non-negative integer (wei)" };
  }
  if (BigInt(v) === 0n) {
    return { valid: false, error: "Goal must be greater than zero" };
  }
  return { valid: true };
}

export function validateDeadline(value: unknown): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: "Deadline is required" };
  }
  const v = typeof value === "string" ? value.trim() : String(value);
  if (v.length === 0) {
    return { valid: false, error: "Deadline is required" };
  }
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, error: "Invalid deadline date" };
  }
  if (date.getTime() <= Date.now()) {
    return { valid: false, error: "Deadline must be in the future" };
  }
  return { valid: true };
}

export interface CreateCampaignBody {
  title?: unknown;
  description?: unknown;
  goal?: unknown;
  deadline?: unknown;
  creator?: unknown;
  campaignAddress?: unknown;
  txHash?: unknown;
}

export function validateCreateCampaignBody(body: CreateCampaignBody): { valid: true; data: { title: string; description: string; goal: string; deadline: string; creator: string; campaignAddress: string; txHash?: string } } | { valid: false; statusCode: number; error: string } {
  const titleR = validateTitle(body.title);
  if (!titleR.valid) return { valid: false, statusCode: 400, error: titleR.error! };

  const descR = validateDescription(body.description);
  if (!descR.valid) return { valid: false, statusCode: 400, error: descR.error! };

  const goalR = validateGoal(body.goal);
  if (!goalR.valid) return { valid: false, statusCode: 400, error: goalR.error! };

  const deadlineR = validateDeadline(body.deadline);
  if (!deadlineR.valid) return { valid: false, statusCode: 400, error: deadlineR.error! };

  const creatorR = validateEthAddress(body.creator);
  if (!creatorR.valid) return { valid: false, statusCode: 400, error: creatorR.error! };

  const addrR = validateEthAddress(body.campaignAddress);
  if (!addrR.valid) return { valid: false, statusCode: 400, error: addrR.error! };

  const txR = validateTxHash(body.txHash);
  if (!txR.valid) return { valid: false, statusCode: 400, error: txR.error! };

  const txHashVal = body.txHash != null && String(body.txHash).trim() !== "" ? String(body.txHash).trim() : undefined;

  return {
    valid: true,
    data: {
      title: String(body.title).trim(),
      description: String(body.description).trim(),
      goal: String(body.goal).trim(),
      deadline: String(body.deadline).trim(),
      creator: String(body.creator).trim().toLowerCase(),
      campaignAddress: String(body.campaignAddress).trim().toLowerCase(),
      ...(txHashVal && { txHash: txHashVal }),
    },
  };
}
