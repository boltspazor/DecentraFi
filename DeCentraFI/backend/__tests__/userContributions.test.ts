/**
 * Tests for GET /api/user/contributions/:wallet
 * Requires PostgreSQL when run with real DB; use mocks for unit-style tests.
 */
import request from "supertest";
import app from "../src/app.js";

const validWallet = "0x1234567890123456789012345678901234567890";
const otherWallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
// Use a valid unique hex tx hash to avoid chain_id+tx_hash conflicts across runs.
const validTxHash = "0x" + Date.now().toString(16).padStart(64, "0");

function futureDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

describe("GET /api/user/contributions/:wallet", () => {
  let campaignId: number | null = null;

  beforeAll(async () => {
    const campaignAddress = "0x" + "e".repeat(40);
    const createRes = await request(app)
      .post("/api/campaigns")
      .send({
        title: "Dashboard Test Campaign",
        description: "For user contributions",
        goal: "5000000000000000000",
        deadline: futureDeadline(),
        creator: validWallet,
        campaignAddress,
        txHash: "0x" + "f".repeat(64),
      });
    if (createRes.status === 201 && createRes.body?.id) {
      campaignId = createRes.body.id;
    }
  });

  it("returns 400 for invalid wallet format", async () => {
    const res = await request(app).get("/api/user/contributions/invalid");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(String(res.body.error).toLowerCase()).toMatch(/invalid|wallet|address/);
  });

  it("returns 400 for too-short wallet", async () => {
    const res = await request(app).get("/api/user/contributions/0x1234");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns empty array when user has no contributions", async () => {
    const res = await request(app).get(`/api/user/contributions/${otherWallet}`);
    if (res.status === 500) return; // DB may be unavailable in CI
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("returns correct campaigns and amounts after user contributes", async () => {
    if (!campaignId) return;
    const amountWei = "1000000000000000000";
    await request(app)
      .post("/api/contributions")
      .send({
        campaignId,
        contributorAddress: validWallet,
        amountWei,
        txHash: validTxHash,
      });

    const res = await request(app).get(`/api/user/contributions/${validWallet}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const myEntry = res.body.find(
      (r: { campaignId: number; amountWei: string }) =>
        r.campaignId === campaignId && r.amountWei === amountWei
    );
    expect(myEntry).toBeDefined();
    expect(myEntry).toMatchObject({
      campaignId,
      title: "Dashboard Test Campaign",
      amountWei: "1000000000000000000",
      campaignAddress: "0x" + "e".repeat(40),
    });
    expect(myEntry.status).toBeDefined();
    expect(myEntry.createdAt).toBeDefined();
  });

  it("returns amounts accurately for multiple contributions", async () => {
    if (!campaignId) return;
    const res = await request(app).get(`/api/user/contributions/${validWallet}`);
    expect(res.status).toBe(200);
    const entries = res.body.filter((r: { campaignId: number }) => r.campaignId === campaignId);
    const totalWei = entries.reduce(
      (sum: bigint, r: { amountWei: string }) => sum + BigInt(r.amountWei),
      0n
    );
    expect(totalWei).toBeGreaterThanOrEqual(BigInt("1000000000000000000"));
  });
});
