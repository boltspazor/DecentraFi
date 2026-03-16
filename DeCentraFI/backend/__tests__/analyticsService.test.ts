import { connectDb, pool } from "../src/config/db.js";
import * as analyticsService from "../src/services/analyticsService.js";

describe("analyticsService.getCampaignAnalytics", () => {
  let campaignId: number;

  beforeAll(async () => {
    await connectDb();
  });

  beforeEach(async () => {
    const client = await pool.connect();
    try {
      await client.query("TRUNCATE TABLE contributions RESTART IDENTITY CASCADE");
      await client.query("TRUNCATE TABLE campaigns RESTART IDENTITY CASCADE");
      const res = await client.query(
        `INSERT INTO campaigns (title, description, goal, deadline, creator, campaign_address)
         VALUES ('Test', 'Desc', '10000000000000000000', NOW() + INTERVAL '7 days', '0xcreator', '0xaddr')
         RETURNING id`
      );
      campaignId = res.rows[0].id as number;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("handles campaign with zero contributions", async () => {
    const analytics = await analyticsService.getCampaignAnalytics(campaignId);
    expect(analytics.totalContributionsWei).toBe("0");
    expect(analytics.uniqueContributors).toBe(0);
    expect(analytics.averageContributionWei).toBe("0");
    expect(analytics.goalCompletionPercentage).toBe(0);
    expect(analytics.timeseries).toHaveLength(0);
  });

  it("handles campaign with a single contributor", async () => {
    const amountWei = "1000000000000000000"; // 1 ETH
    await pool.query(
      `INSERT INTO contributions (campaign_id, contributor_address, amount_wei, tx_hash, chain_id)
       VALUES ($1, $2, $3, $4, 1)`,
      [campaignId, "0xcontrib1", amountWei, "0x" + "1".padStart(64, "0")]
    );

    const analytics = await analyticsService.getCampaignAnalytics(campaignId);
    expect(analytics.totalContributionsWei).toBe(amountWei);
    expect(analytics.uniqueContributors).toBe(1);
    expect(analytics.timeseries).toHaveLength(1);
    expect(analytics.timeseries[0].cumulativeWei).toBe(amountWei);
  });

  it("handles large number of contributions without errors", async () => {
    const inserts: Promise<unknown>[] = [];
    for (let i = 0; i < 200; i += 1) {
      inserts.push(
        pool.query(
          `INSERT INTO contributions (campaign_id, contributor_address, amount_wei, tx_hash, chain_id, created_at)
           VALUES ($1, $2, $3, $4, 1, NOW() + ($5 || ' seconds')::interval)`,
          [
            campaignId,
            `0xcontrib${i % 10}`.padEnd(42, "0"),
            "1000000000000000", // 0.001 ETH
            "0x" + i.toString(16).padStart(64, "0"),
            i.toString(),
          ]
        )
      );
    }
    await Promise.all(inserts);

    const analytics = await analyticsService.getCampaignAnalytics(campaignId);
    expect(analytics.timeseries.length).toBe(200);
    expect(analytics.uniqueContributors).toBeGreaterThan(0);
  });
}
);

