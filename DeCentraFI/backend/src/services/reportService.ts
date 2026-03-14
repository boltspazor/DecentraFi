import { pool } from "../config/db.js";

export interface ReportRow {
  id: number;
  campaign_id: number;
  reporter_wallet: string;
  reason: string | null;
  created_at: Date;
}

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function create(data: {
  campaignId: number;
  reporterWallet: string;
  reason?: string;
}): Promise<ReportRow> {
  const wallet = data.reporterWallet.trim();
  if (!ETH_ADDRESS_REGEX.test(wallet)) {
    const err = new Error("Invalid reporter wallet address");
    (err as NodeJS.ErrnoException).code = "INVALID_WALLET";
    throw err;
  }
  try {
    const result = await pool.query(
      `INSERT INTO campaign_reports (campaign_id, reporter_wallet, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.campaignId, wallet.toLowerCase(), data.reason ?? null]
    );
    if (!result.rows[0]) throw new Error("Insert failed");
    return result.rows[0] as ReportRow;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      const dup = new Error("This wallet has already reported this campaign");
      (dup as NodeJS.ErrnoException).code = "DUPLICATE_REPORT";
      throw dup;
    }
    throw e;
  }
}

export async function findByCampaignId(campaignId: number): Promise<ReportRow[]> {
  const result = await pool.query(
    `SELECT * FROM campaign_reports WHERE campaign_id = $1 ORDER BY created_at DESC`,
    [campaignId]
  );
  return result.rows as ReportRow[];
}

export async function getReportCountByCampaignId(campaignId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM campaign_reports WHERE campaign_id = $1`,
    [campaignId]
  );
  return (result.rows[0] as { count: number })?.count ?? 0;
}

/** All campaigns that have at least one report (for admin list). */
export async function findCampaignIdsWithReports(): Promise<number[]> {
  const result = await pool.query(
    `SELECT DISTINCT campaign_id FROM campaign_reports ORDER BY campaign_id DESC`
  );
  return result.rows.map((r: { campaign_id: number }) => r.campaign_id);
}
