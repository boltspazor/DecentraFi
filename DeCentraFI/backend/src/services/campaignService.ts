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
  return result.rows[0] as CampaignRow;
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
