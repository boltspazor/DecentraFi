import { pool } from "../config/db.js";

export interface SupporterNftRow {
  id: number;
  token_id: string;
  campaign_id: number;
  contributor_wallet: string;
  nft_level: string;
  ipfs_hash: string;
  created_at: Date;
}

export async function findByWallet(wallet: string): Promise<SupporterNftRow[]> {
  const normalized = wallet.toLowerCase();
  const result = await pool.query(
    `
      SELECT id, token_id, campaign_id, contributor_wallet, nft_level, ipfs_hash, created_at
      FROM supporter_nfts
      WHERE contributor_wallet = $1
      ORDER BY created_at DESC
    `,
    [normalized]
  );
  return result.rows as SupporterNftRow[];
}

