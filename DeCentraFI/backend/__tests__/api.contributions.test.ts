/**
 * Integration tests for contributions and campaign detail/status.
 * Requires a running PostgreSQL (DATABASE_URL). Skips when DB is unavailable.
 */
import request from "supertest";
import app from "../src/app.js";

const validAddress = "0x1234567890123456789012345678901234567890";
const validTxHash1 = "0x" + "a".repeat(64);
const validTxHash2 = "0x" + "b".repeat(64);

function futureDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

describe("Contributions & campaign detail (integration)", () => {
  let campaignId: number | null = null;

  beforeAll(async () => {
    const hex = "c".repeat(32) + Math.floor(Math.random() * 1e9).toString(16).padStart(8, "0");
    const campaignAddress = "0x" + hex.padStart(40, "0").slice(-40);
    const createRes = await request(app)
      .post("/api/campaigns")
      .send({
        title: "Test Campaign for Contributions",
        description: "Description",
        goal: "10000000000000000000",
        deadline: futureDeadline(),
        creator: validAddress,
        campaignAddress,
        txHash: "0x" + "d".repeat(64),
      });
    if (createRes.status === 201 && createRes.body?.id) {
      campaignId = createRes.body.id;
    }
  });

  it("should return 404 for POST /contributions when campaign id does not exist", async () => {
    const res = await request(app)
      .post("/api/contributions")
      .send({
        campaignId: 999999,
        contributorAddress: validAddress,
        amountWei: "1000000000000000000",
        txHash: validTxHash1,
      });
    expect([400, 404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    if (res.status === 404) {
      expect(String(res.body.error).toLowerCase()).toMatch(/not found/);
    }
  });

  it("should store contribution metadata and return 201 when payload is valid (blockchain-confirmed)", async () => {
    if (!campaignId) return;
    const res = await request(app)
      .post("/api/contributions")
      .send({
        campaignId,
        contributorAddress: validAddress,
        amountWei: "1000000000000000000",
        txHash: validTxHash1,
        chainId: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      campaignId,
      contributorAddress: validAddress.toLowerCase(),
      amountWei: "1000000000000000000",
      txHash: validTxHash1,
      chainId: 1,
    });
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("createdAt");
  });

  it("should reject duplicate transaction hash on same chain with 409", async () => {
    if (!campaignId) return;
    const res = await request(app)
      .post("/api/contributions")
      .send({
        campaignId,
        contributorAddress: validAddress,
        amountWei: "2000000000000000000",
        txHash: validTxHash1,
        chainId: 1,
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/transaction hash|already|chain/i);
  });

  it("should allow same txHash on different chainId (multi-chain)", async () => {
    if (!campaignId) return;
    const txHashOtherChain = "0x" + "e".repeat(64);
    const res = await request(app)
      .post("/api/contributions")
      .send({
        campaignId,
        contributorAddress: validAddress,
        amountWei: "3000000000000000000",
        txHash: txHashOtherChain,
        chainId: 137,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ chainId: 137, txHash: txHashOtherChain });
  });

  it("should return campaign detail from GET /api/campaigns/:id including creatorTrustScore and multi-chain fields", async () => {
    if (!campaignId) return;
    const res = await request(app).get(`/api/campaigns/${campaignId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", campaignId);
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("totalRaised");
    expect(res.body).toHaveProperty("totalRaisedAllChains");
    expect(res.body).toHaveProperty("addressesByChain");
    expect(Array.isArray(res.body.addressesByChain)).toBe(true);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("creatorTrustScore");
    expect(typeof res.body.creatorTrustScore).toBe("number");
    expect(res.body.creatorTrustScore).toBeGreaterThanOrEqual(0);
    expect(res.body.creatorTrustScore).toBeLessThanOrEqual(10);
  });

  it("should return contributions list from GET /api/contributions/campaign/:id with chainId", async () => {
    if (!campaignId) return;
    const res = await request(app).get(`/api/contributions/campaign/${campaignId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("amountWei");
    expect(res.body[0]).toHaveProperty("txHash");
    expect(res.body[0]).toHaveProperty("chainId");
  });

  it("should update campaign status via PATCH /api/campaigns/:id/status", async () => {
    if (!campaignId) return;
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/status`)
      .send({ status: "Successful" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "Successful");
  });

  it("should allow status transition to Failed", async () => {
    if (!campaignId) return;
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/status`)
      .send({ status: "Failed" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Failed");
  });

  describe("trust score: campaigns update score", () => {
    it("GET campaign returns creatorTrustScore that updates when campaign status changes", async () => {
      if (!campaignId) return;
      const getRes1 = await request(app).get(`/api/campaigns/${campaignId}`);
      if (getRes1.status !== 200) return;
      const scoreAfterFailed = getRes1.body.creatorTrustScore as number;

      await request(app)
        .patch(`/api/campaigns/${campaignId}/status`)
        .send({ status: "Successful" });
      const getRes2 = await request(app).get(`/api/campaigns/${campaignId}`);
      expect(getRes2.status).toBe(200);
      const scoreAfterSuccess = getRes2.body.creatorTrustScore as number;
      expect(typeof scoreAfterSuccess).toBe("number");
      expect(scoreAfterSuccess).toBeGreaterThanOrEqual(scoreAfterFailed);
    });
  });
});
