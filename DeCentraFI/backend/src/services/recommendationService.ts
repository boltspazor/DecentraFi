import { pool } from "../config/db.js";
import type { CampaignRow } from "./campaignService.js";

const DEFAULT_LIMIT = 12;
const COLLAB_WEIGHT = 0.6;
const SIMILARITY_WEIGHT = 0.4;

/**
 * AI-style recommendations using:
 * - Collaborative filtering: campaigns that similar users (co-contributors) also funded
 * - Campaign similarity: same category, similar goal band, funding history (active, progressing)
 */
export async function getRecommendationsForWallet(
  walletAddress: string,
  limit: number = DEFAULT_LIMIT
): Promise<CampaignRow[]> {
  const addr = walletAddress.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return [];
  }

  const campaignScores = new Map<number, number>();

  // 1) Collaborative filtering: other users who contributed to same campaigns as this user
  const collabResult = await pool.query(
    `WITH user_campaigns AS (
       SELECT DISTINCT campaign_id FROM contributions WHERE contributor_address = $1
     ),
     co_contributors AS (
       SELECT c.contributor_address, c.campaign_id
       FROM contributions c
       INNER JOIN user_campaigns uc ON c.campaign_id = uc.campaign_id
       WHERE c.contributor_address != $1
     ),
     recommended_campaigns AS (
       SELECT c.campaign_id, COUNT(DISTINCT c.contributor_address) AS score
       FROM contributions c
       INNER JOIN co_contributors cc ON c.contributor_address = cc.contributor_address
       WHERE c.campaign_id NOT IN (SELECT campaign_id FROM user_campaigns)
       GROUP BY c.campaign_id
     )
     SELECT campaign_id, score::int FROM recommended_campaigns`
    ,
    [addr]
  );
  const maxCollab = collabResult.rows.length
    ? Math.max(...collabResult.rows.map((r: { score: number }) => r.score), 1)
    : 1;
  for (const row of collabResult.rows as { campaign_id: number; score: number }[]) {
    const normalized = row.score / maxCollab;
    campaignScores.set(row.campaign_id, (campaignScores.get(row.campaign_id) ?? 0) + COLLAB_WEIGHT * normalized);
  }

  // 2) Campaign similarity: user's campaign categories + goal band + active status
  const userCampaignsResult = await pool.query(
    `SELECT c.id, c.category, c.goal, c.status, c.total_raised
     FROM campaigns c
     INNER JOIN contributions contrib ON contrib.campaign_id = c.id
     WHERE contrib.contributor_address = $1`,
    [addr]
  );
  const userCategories = new Set<string>();
  const userGoalBands: number[] = [];
  for (const row of userCampaignsResult.rows as { id: number; category: string | null; goal: string; status: string | null; total_raised: string | null }[]) {
    if (row.category) userCategories.add(row.category.trim().toLowerCase());
    const goalNum = Number(row.goal);
    if (Number.isFinite(goalNum) && goalNum > 0) userGoalBands.push(goalNum);
  }
  const userContributedIds = (userCampaignsResult.rows as { id: number }[]).map((r) => r.id);
  const avgGoal = userGoalBands.length ? userGoalBands.reduce((a, b) => a + b, 0) / userGoalBands.length : 0;

  const similarResult = await pool.query(
    `SELECT id, category, goal, total_raised, status
     FROM campaigns
     WHERE LOWER(COALESCE(TRIM(status), '')) = 'active'
       AND deadline > NOW()
       AND id != ALL($1::int[])`,
    [userContributedIds.length ? userContributedIds : [0]]
  );
  const maxSimScore = Math.max(similarResult.rows.length, 1);
  let simIdx = 0;
  for (const row of similarResult.rows as { id: number; category: string | null; goal: string; total_raised: string | null; status: string | null }[]) {
    let simScore = 0;
    if (userCategories.size && row.category && userCategories.has(row.category.trim().toLowerCase())) {
      simScore += 0.5;
    }
    const goalNum = Number(row.goal);
    if (Number.isFinite(goalNum) && avgGoal > 0) {
      const ratio = goalNum / avgGoal;
      if (ratio >= 0.25 && ratio <= 4) simScore += 0.3;
    }
    const raised = Number(row.total_raised ?? 0);
    if (Number.isFinite(raised) && goalNum > 0 && raised / goalNum > 0 && raised / goalNum < 1) {
      simScore += 0.2;
    }
    const normalized = (simScore + (maxSimScore - simIdx) / maxSimScore * 0.2);
    campaignScores.set(row.id, (campaignScores.get(row.id) ?? 0) + SIMILARITY_WEIGHT * Math.min(1, normalized));
    simIdx += 1;
  }

  const sorted = [...campaignScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (sorted.length === 0) {
    return [];
  }

  const listResult = await pool.query(
    `SELECT * FROM campaigns WHERE id = ANY($1::int[])`,
    [sorted]
  );
  const rows = listResult.rows as CampaignRow[];
  const orderMap = new Map(sorted.map((id, i) => [id, i]));
  rows.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
  return rows;
}
