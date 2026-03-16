import { pool } from "../config/db.js";

export interface CampaignAnalytics {
  campaignId: number;
  totalContributionsWei: string;
  uniqueContributors: number;
  averageContributionWei: string;
  fundingSpeedWeiPerHour: string;
  goalCompletionPercentage: number;
  timeseries: {
    timestamp: string;
    cumulativeWei: string;
    contributionCount: number;
  }[];
}

export interface GlobalAnalytics {
  totalContributionsWei: string;
  uniqueContributors: number;
  totalCampaigns: number;
  averageContributionWei: string;
}

export async function getCampaignAnalytics(campaignId: number): Promise<CampaignAnalytics> {
  const client = await pool.connect();
  try {
    const aggRes = await client.query<{
      total_wei: string | null;
      unique_contributors: string;
      avg_wei: string | null;
      first_ts: Date | null;
      last_ts: Date | null;
    }>(
      `
      SELECT
        COALESCE(SUM(amount_wei::numeric), 0)::text AS total_wei,
        COUNT(DISTINCT contributor_address)::text AS unique_contributors,
        COALESCE(AVG(amount_wei::numeric), 0)::text AS avg_wei,
        MIN(created_at) AS first_ts,
        MAX(created_at) AS last_ts
      FROM contributions
      WHERE campaign_id = $1
      `,
      [campaignId]
    );
    const agg = aggRes.rows[0];
    const totalWeiStr = agg?.total_wei ?? "0";
    const totalWei = BigInt(totalWeiStr);
    const uniqueContributors = Number(agg?.unique_contributors ?? "0");
    const avgWeiStr = agg?.avg_wei ?? "0";

    const timeseriesRes = await client.query<{
      ts: Date;
      cumulative_wei: string;
      count: number;
    }>(
      `
      SELECT
        created_at AS ts,
        SUM(amount_wei::numeric) OVER (ORDER BY created_at)::text AS cumulative_wei,
        ROW_NUMBER() OVER (ORDER BY created_at) AS count
      FROM contributions
      WHERE campaign_id = $1
      ORDER BY created_at ASC
      `,
      [campaignId]
    );

    let fundingSpeedWeiPerHour = "0";
    if (agg.first_ts && agg.last_ts && agg.first_ts.getTime() !== agg.last_ts.getTime()) {
      const msDiff = agg.last_ts.getTime() - agg.first_ts.getTime();
      const hours = msDiff / (1000 * 60 * 60);
      if (hours > 0) {
        const weiPerHour = Number(totalWei) / hours;
        fundingSpeedWeiPerHour = Math.floor(weiPerHour).toString();
      }
    }

    const campaignResult = await client.query<{ goal: string }>(
      `SELECT goal FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    const goalWei = campaignResult.rows[0]?.goal ? BigInt(campaignResult.rows[0].goal) : 0n;
    const goalCompletionPercentage =
      goalWei > 0n ? Math.min(100, Number((totalWei * 100n) / goalWei)) : 0;

    return {
      campaignId,
      totalContributionsWei: totalWeiStr,
      uniqueContributors,
      averageContributionWei: avgWeiStr,
      fundingSpeedWeiPerHour,
      goalCompletionPercentage,
      timeseries: timeseriesRes.rows.map((row) => ({
        timestamp: row.ts.toISOString(),
        cumulativeWei: row.cumulative_wei,
        contributionCount: row.count,
      })),
    };
  } finally {
    client.release();
  }
}

export async function getGlobalAnalytics(): Promise<GlobalAnalytics> {
  const res = await pool.query<{
    total_wei: string | null;
    unique_contributors: string;
    avg_wei: string | null;
    total_campaigns: string;
  }>(
    `
    SELECT
      COALESCE(SUM(amount_wei::numeric), 0)::text AS total_wei,
      COUNT(DISTINCT contributor_address)::text AS unique_contributors,
      COALESCE(AVG(amount_wei::numeric), 0)::text AS avg_wei,
      (SELECT COUNT(*)::text FROM campaigns) AS total_campaigns
    FROM contributions
    `
  );
  const row = res.rows[0];
  return {
    totalContributionsWei: row?.total_wei ?? "0",
    uniqueContributors: Number(row?.unique_contributors ?? "0"),
    totalCampaigns: Number(row?.total_campaigns ?? "0"),
    averageContributionWei: row?.avg_wei ?? "0",
  };
}

