import { pool } from "../config/db.js";

export interface CreatorProfileRow {
  wallet: string;
  ens_name: string | null;
  lens_handle: string | null;
  ceramic_did: string | null;
  is_verified: boolean;
  updated_at: Date;
  created_at: Date;
}

export async function upsertProfile(input: {
  wallet: string;
  ensName?: string | null;
  lensHandle?: string | null;
  ceramicDid?: string | null;
}): Promise<CreatorProfileRow> {
  const wallet = input.wallet.trim().toLowerCase();
  const result = await pool.query(
    `
    INSERT INTO creator_profiles (wallet, ens_name, lens_handle, ceramic_did, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (wallet) DO UPDATE
      SET ens_name = EXCLUDED.ens_name,
          lens_handle = EXCLUDED.lens_handle,
          ceramic_did = EXCLUDED.ceramic_did,
          updated_at = NOW()
    RETURNING *;
    `,
    [
      wallet,
      input.ensName ? input.ensName.trim() : null,
      input.lensHandle ? input.lensHandle.trim() : null,
      input.ceramicDid ? input.ceramicDid.trim() : null,
    ]
  );
  return result.rows[0] as CreatorProfileRow;
}

export async function getProfile(walletAddress: string): Promise<CreatorProfileRow | null> {
  const wallet = walletAddress.trim().toLowerCase();
  const result = await pool.query(`SELECT * FROM creator_profiles WHERE wallet = $1`, [wallet]);
  return (result.rows[0] as CreatorProfileRow) || null;
}

export async function setVerified(walletAddress: string, verified: boolean): Promise<void> {
  const wallet = walletAddress.trim().toLowerCase();
  await pool.query(
    `INSERT INTO creator_profiles (wallet, is_verified, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (wallet) DO UPDATE SET is_verified = $2, updated_at = NOW()`,
    [wallet, verified]
  );
}

