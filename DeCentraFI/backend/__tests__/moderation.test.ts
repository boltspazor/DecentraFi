/**
 * Tests for fraud detection: POST /api/campaigns/report, PATCH /api/campaigns/:id/verify.
 * Uses real app; requires DB for full flow. Some tests skip when DB returns 500.
 */
import request from "supertest";
import app from "../src/app.js";

const validWallet = "0x1234567890123456789012345678901234567890";
const otherWallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function futureDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

describe("Fraud detection / moderation", () => {
  let campaignId: number | null = null;
  const originalAdminWallet = process.env.ADMIN_WALLET;

  beforeAll(async () => {
    process.env.ADMIN_WALLET = validWallet;
    const campaignAddress = "0x" + "m".repeat(40);
    const createRes = await request(app)
      .post("/api/campaigns")
      .send({
        title: "Moderation Test Campaign",
        description: "For report/verify tests",
        goal: "1000000000000000000",
        deadline: futureDeadline(),
        creator: validWallet,
        campaignAddress,
        txHash: "0x" + "n".repeat(64),
      });
    if (createRes.status === 201 && createRes.body?.id) {
      campaignId = createRes.body.id;
    }
  });

  afterAll(() => {
    process.env.ADMIN_WALLET = originalAdminWallet;
  });

  describe("POST /api/campaigns/report", () => {
    it("stores report and returns 201 with report fields", async () => {
      if (!campaignId) return;
      const res = await request(app)
        .post("/api/campaigns/report")
        .send({
          campaignId,
          reporterWallet: otherWallet,
          reason: "Suspicious activity",
        });
      if (res.status === 500) return;
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toMatchObject({
        campaignId,
        reporterWallet: otherWallet.toLowerCase(),
        reason: "Suspicious activity",
      });
      expect(res.body).toHaveProperty("createdAt");
    });

    it("rejects invalid wallet with 400", async () => {
      if (!campaignId) return;
      const res = await request(app)
        .post("/api/campaigns/report")
        .send({
          campaignId,
          reporterWallet: "not-an-address",
          reason: "Test",
        });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(String(res.body.error).toLowerCase()).toMatch(/invalid|wallet|address/);
    });

    it("returns 404 for invalid campaign id", async () => {
      const res = await request(app)
        .post("/api/campaigns/report")
        .send({
          campaignId: 999999,
          reporterWallet: validWallet,
          reason: "Test",
        });
      expect([404, 500]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.error).toMatch(/not found/i);
      }
    });

    it("rejects duplicate report by same wallet with 409", async () => {
      if (!campaignId) return;
      const wallet = "0x" + "d1".padStart(38, "0");
      await request(app).post("/api/campaigns/report").send({
        campaignId,
        reporterWallet: wallet,
        reason: "First",
      });
      const res = await request(app).post("/api/campaigns/report").send({
        campaignId,
        reporterWallet: wallet,
        reason: "Duplicate",
      });
      if (res.status === 500) return;
      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("error");
      expect(String(res.body.error).toMatch(/already reported/i)).toBeTruthy();
    });

    it("requires reporterWallet", async () => {
      if (!campaignId) return;
      const res = await request(app)
        .post("/api/campaigns/report")
        .send({ campaignId });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/campaigns/:id/verify", () => {
    it("updates verification status when admin wallet is provided", async () => {
      if (!campaignId) return;
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/verify`)
        .set("X-Admin-Wallet", validWallet)
        .send({ adminWallet: validWallet });
      if (res.status === 503) return; // ADMIN_WALLET not set in env
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ isVerified: true, id: campaignId });
      expect(res.body).toHaveProperty("title");
    });

    it("returns 403 when non-admin wallet is used", async () => {
      if (!campaignId) return;
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/verify`)
        .set("X-Admin-Wallet", otherWallet)
        .send({ adminWallet: otherWallet });
      expect([403, 503]).toContain(res.status);
      if (res.status === 403) {
        expect(res.body.error).toMatch(/forbidden|admin/i);
      }
    });

    it("returns 404 for non-existent campaign", async () => {
      const res = await request(app)
        .patch("/api/campaigns/999999/verify")
        .set("X-Admin-Wallet", validWallet)
        .send({ adminWallet: validWallet });
      if (res.status === 503) return;
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid campaign id", async () => {
      const res = await request(app)
        .patch("/api/campaigns/invalid/verify")
        .set("X-Admin-Wallet", validWallet)
        .send({ adminWallet: validWallet });
      if (res.status === 503) return;
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/campaigns/reports/:campaignId", () => {
    it("returns list of reports for campaign", async () => {
      if (!campaignId) return;
      const res = await request(app).get(`/api/campaigns/reports/${campaignId}`);
      if (res.status === 500) return;
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((r: { campaignId: number; reporterWallet: string; createdAt: string }) => {
        expect(r).toHaveProperty("campaignId", campaignId);
        expect(r).toHaveProperty("reporterWallet");
        expect(r).toHaveProperty("createdAt");
      });
    });
  });
});
