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
