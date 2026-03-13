import { pool } from "../config/db.js";

export interface ContributionRow {
  id: number;
  campaign_id: number;
  contributor_address: string;
  amount_wei: string;
  tx_hash: string;
  created_at: Date;
}

export async function create(data: {
  campaignId: number;
  contributorAddress: string;
  amountWei: string;
  txHash: string;
}): Promise<ContributionRow> {
  const result = await pool.query(
    `INSERT INTO contributions (campaign_id, contributor_address, amount_wei, tx_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.campaignId,
      data.contributorAddress.toLowerCase(),
      data.amountWei,
      data.txHash.toLowerCase().startsWith("0x") ? data.txHash : "0x" + data.txHash,
    ]
  );
  if (!result.rows[0]) throw new Error("Insert failed");
  return result.rows[0] as ContributionRow;
}

export async function findByCampaignId(campaignId: number): Promise<ContributionRow[]> {
  const result = await pool.query(
    "SELECT * FROM contributions WHERE campaign_id = $1 ORDER BY created_at DESC",
    [campaignId]
  );
  return result.rows as ContributionRow[];
}

export async function findByTxHash(txHash: string): Promise<ContributionRow | null> {
  const h = txHash.toLowerCase().startsWith("0x") ? txHash : "0x" + txHash;
  const result = await pool.query("SELECT * FROM contributions WHERE tx_hash = $1", [h]);
  return (result.rows[0] as ContributionRow) || null;
}

export async function findUserContributions(walletAddress: string) {
  const addr = walletAddress.toLowerCase();
  const result = await pool.query(
    `SELECT
       c.id          AS campaign_id,
       c.title       AS title,
       c.status      AS status,
       c.campaign_address AS campaign_address,
       contrib.amount_wei AS amount_wei,
       contrib.created_at AS created_at
     FROM contributions contrib
     JOIN campaigns c ON c.id = contrib.campaign_id
     WHERE contrib.contributor_address = $1
     ORDER BY contrib.created_at DESC`,
    [addr]
  );
  return result.rows as {
    campaign_id: number;
    title: string;
    status: string | null;
    campaign_address: string;
    amount_wei: string;
    created_at: Date;
  }[];
}
