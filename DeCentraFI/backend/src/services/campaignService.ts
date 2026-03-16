import { pool } from "../config/db.js";

export interface CampaignRow {
  id: number;
  title: string;
  description: string;
  goal: string;
  deadline: Date;
  creator: string;
  campaign_address: string;
  tx_hash: string | null;
  total_raised?: string;
  status?: string;
  is_verified?: boolean;
  category?: string | null;
  created_at: Date;
}

export async function create(data: {
  title: string;
  description: string;
  goal: string;
  deadline: string;
  creator: string;
  campaignAddress: string;
  txHash?: string;
}): Promise<CampaignRow> {
  const normalizedAddress = data.campaignAddress.toLowerCase();
  const existing = await findByCampaignAddress(normalizedAddress);
  if (existing) {
    const err = new Error("A campaign with this contract address is already registered");
    (err as NodeJS.ErrnoException).code = "DUPLICATE_CAMPAIGN";
    throw err;
  }
  const result = await pool.query(
    `INSERT INTO campaigns (title, description, goal, deadline, creator, campaign_address, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.title,
      data.description,
      data.goal,
      new Date(data.deadline),
      data.creator,
      normalizedAddress,
      data.txHash ?? null,
    ]
  );
  if (!result.rows[0]) {
    throw new Error("Insert failed");
  }
  const row = result.rows[0] as CampaignRow;
  await registerCampaignChainAddress(row.id, 1, normalizedAddress);
  return row;
}

export async function findAll(): Promise<CampaignRow[]> {
  const result = await pool.query(
    "SELECT * FROM campaigns ORDER BY created_at DESC"
  );
  return result.rows as CampaignRow[];
}

export async function findById(id: string): Promise<CampaignRow | null> {
  const result = await pool.query("SELECT * FROM campaigns WHERE id = $1", [id]);
  return (result.rows[0] as CampaignRow) || null;
}

export async function findByCampaignAddress(
  campaignAddress: string
): Promise<CampaignRow | null> {
  const result = await pool.query(
    "SELECT * FROM campaigns WHERE campaign_address = $1",
    [campaignAddress.toLowerCase()]
  );
  return (result.rows[0] as CampaignRow) || null;
}

export async function updateTotalRaisedAndStatus(
  campaignId: number,
  totalRaised: string,
  status: string
): Promise<void> {
  await pool.query(
    "UPDATE campaigns SET total_raised = $1, status = $2 WHERE id = $3",
    [totalRaised, status, campaignId]
  );
}

export async function updateVerified(campaignId: number, isVerified: boolean): Promise<void> {
  await pool.query("UPDATE campaigns SET is_verified = $1 WHERE id = $2", [isVerified, campaignId]);
}

export interface CampaignChainAddressRow {
  campaign_id: number;
  chain_id: number;
  campaign_address: string;
}

export async function getAddressesByChain(campaignId: number): Promise<{ chainId: number; campaignAddress: string }[]> {
  const result = await pool.query(
    "SELECT chain_id, campaign_address FROM campaign_chain_addresses WHERE campaign_id = $1 ORDER BY chain_id",
    [campaignId]
  );
  return (result.rows as CampaignChainAddressRow[]).map((r) => ({
    chainId: r.chain_id,
    campaignAddress: r.campaign_address,
  }));
}

export async function getTotalRaisedAllChains(campaignId: number): Promise<string> {
  const result = await pool.query(
    "SELECT COALESCE(SUM(amount_wei::numeric), 0)::text AS total FROM contributions WHERE campaign_id = $1",
    [campaignId]
  );
  const total = result.rows[0]?.total ?? "0";
  return String(BigInt(total));
}

export async function registerCampaignChainAddress(
  campaignId: number,
  chainId: number,
  campaignAddress: string
): Promise<void> {
  await pool.query(
    `INSERT INTO campaign_chain_addresses (campaign_id, chain_id, campaign_address)
     VALUES ($1, $2, $3)
     ON CONFLICT (campaign_id, chain_id) DO UPDATE SET campaign_address = $3`,
    [campaignId, chainId, campaignAddress.toLowerCase()]
  );
}

export interface SearchCampaignsOptions {
  q?: string;
  status?: string;
  goalMinWei?: string;
  goalMaxWei?: string;
  deadlineBefore?: Date;
  page: number;
  pageSize: number;
}

export interface SearchCampaignsResult {
  items: CampaignRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Trust score: (successfulCampaigns * 2) - failedCampaigns, clamped to 0–10 for display. */
export async function getCreatorTrustScore(creatorAddress: string): Promise<{
  trustScore: number;
  successfulCampaigns: number;
  failedCampaigns: number;
}> {
  const creator = creatorAddress.toLowerCase();
  const countResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'successful')::int AS successful,
       COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'failed')::int AS failed
     FROM campaigns
     WHERE LOWER(creator) = $1`,
    [creator]
  );
  const row = countResult.rows[0] as { successful: number; failed: number };
  const successful = row?.successful ?? 0;
  const failed = row?.failed ?? 0;
  const rawScore = successful * 2 - failed;
  const trustScore = Math.max(0, Math.min(10, rawScore));
  return { trustScore, successfulCampaigns: successful, failedCampaigns: failed };
}

export async function searchCampaigns(options: SearchCampaignsOptions): Promise<SearchCampaignsResult> {
  const whereParts: string[] = [];
  const values: unknown[] = [];

  if (options.q && options.q.trim()) {
    values.push(`%${options.q.trim()}%`);
    const idx = values.length;
    whereParts.push(`(title ILIKE $${idx} OR description ILIKE $${idx} OR creator ILIKE $${idx})`);
  }

  if (options.status && options.status.trim()) {
    values.push(options.status.trim());
    whereParts.push(`status = $${values.length}`);
  }

  if (options.goalMinWei) {
    values.push(options.goalMinWei);
    whereParts.push(`goal >= $${values.length}`);
  }

  if (options.goalMaxWei) {
    values.push(options.goalMaxWei);
    whereParts.push(`goal <= $${values.length}`);
  }

  if (options.deadlineBefore) {
    values.push(options.deadlineBefore);
    whereParts.push(`deadline <= $${values.length}`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*)::int AS count FROM campaigns ${whereSql}`;
  const countResult = await pool.query(countSql, values);
  const total: number = countResult.rows[0]?.count ?? 0;

  const page = Math.max(1, options.page);
  const pageSize = Math.max(1, Math.min(options.pageSize, 50));
  const offset = (page - 1) * pageSize;

  const listSql = `
    SELECT * FROM campaigns
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;
  const listValues = [...values, pageSize, offset];
  const listResult = await pool.query(listSql, listValues);

  return {
    items: listResult.rows as CampaignRow[],
    total,
    page,
    pageSize,
  };
}
