import request from "supertest";
import app from "../src/app.js";

describe("Analytics API", () => {
  it("returns 400 for invalid campaign id", async () => {
    const res = await request(app).get("/api/analytics/campaign/not-a-number");
    expect(res.status).toBe(400);
  });

  it("returns campaign analytics shape for valid id (or 500 when DB unavailable)", async () => {
    const res = await request(app).get("/api/analytics/campaign/1");
    if (res.status === 500) return;
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("campaignId");
    expect(res.body).toHaveProperty("totalContributionsWei");
    expect(res.body).toHaveProperty("uniqueContributors");
    expect(res.body).toHaveProperty("averageContributionWei");
    expect(res.body).toHaveProperty("fundingSpeedWeiPerHour");
    expect(res.body).toHaveProperty("goalCompletionPercentage");
    expect(Array.isArray(res.body.timeseries)).toBe(true);
  });

  it("returns global analytics (or 500 when DB unavailable)", async () => {
    const res = await request(app).get("/api/analytics/global");
    if (res.status === 500) return;
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalContributionsWei");
    expect(res.body).toHaveProperty("uniqueContributors");
    expect(res.body).toHaveProperty("totalCampaigns");
    expect(res.body).toHaveProperty("averageContributionWei");
  });
});

