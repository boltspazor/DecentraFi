import { pool } from "../config/db.js";

export interface QfCampaignAllocation {
  campaignId: number;
  contributorCount: number;
  totalContributedWei: string;
  qfScoreWei: string;
  matchingAllocationWei: string;
}

function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("isqrt: negative");
  if (n < 2n) return n;
  // Newton iteration
  let x0 = n;
  let x1 = (x0 + n / x0) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) >> 1n;
  }
  return x0;
}

function clampNonNegBigint(v: bigint): bigint {
  return v < 0n ? 0n : v;
}

export async function getQfAllocations(matchingPoolWei: bigint): Promise<{
  matchingPoolWei: string;
  totalScoreWei: string;
  allocations: QfCampaignAllocation[];
}> {
  const result = await pool.query(
    `
    SELECT
      campaign_id,
      contributor_address,
      SUM(amount_wei::numeric)::text AS amount_wei
    FROM contributions
    GROUP BY campaign_id, contributor_address
    `
  );

  const perCampaign = new Map<
    number,
    { contributorCount: number; totalContributed: bigint; sumSqrt: bigint }
  >();

  for (const row of result.rows as { campaign_id: number; contributor_address: string; amount_wei: string }[]) {
    const campaignId = row.campaign_id;
    const amt = BigInt(row.amount_wei);
    const entry = perCampaign.get(campaignId) ?? { contributorCount: 0, totalContributed: 0n, sumSqrt: 0n };
    entry.contributorCount += 1;
    entry.totalContributed += amt;
    entry.sumSqrt += isqrt(amt);
    perCampaign.set(campaignId, entry);
  }

  const scored: Array<{
    campaignId: number;
    contributorCount: number;
    totalContributed: bigint;
    score: bigint;
  }> = [];

  let totalScore = 0n;
  for (const [campaignId, v] of perCampaign.entries()) {
    const score = v.sumSqrt * v.sumSqrt;
    totalScore += score;
    scored.push({
      campaignId,
      contributorCount: v.contributorCount,
      totalContributed: v.totalContributed,
      score,
    });
  }

  const poolWei = clampNonNegBigint(matchingPoolWei);
  const allocations: QfCampaignAllocation[] = scored
    .sort((a, b) => b.score === a.score ? b.totalContributed > a.totalContributed ? 1 : -1 : b.score > a.score ? 1 : -1)
    .map((c) => {
      const alloc = totalScore > 0n ? (poolWei * c.score) / totalScore : 0n;
      return {
        campaignId: c.campaignId,
        contributorCount: c.contributorCount,
        totalContributedWei: c.totalContributed.toString(),
        qfScoreWei: c.score.toString(),
        matchingAllocationWei: alloc.toString(),
      };
    });

  return {
    matchingPoolWei: poolWei.toString(),
    totalScoreWei: totalScore.toString(),
    allocations,
  };
}

export async function getQfImpactForCampaign(campaignId: number, matchingPoolWei: bigint) {
  const { allocations, matchingPoolWei: pool, totalScoreWei } = await getQfAllocations(matchingPoolWei);
  const found = allocations.find((a) => a.campaignId === campaignId) ?? null;
  return { matchingPoolWei: pool, totalScoreWei, impact: found };
}

