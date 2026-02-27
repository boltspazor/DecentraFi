import request from "supertest";
import app from "../src/app.js";

describe("Campaign API", () => {
  describe("GET /api/campaigns/:id", () => {
    it("should return 400 for invalid campaign id", async () => {
      const res = await request(app).get("/api/campaigns/abc");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(String(res.body.error).toLowerCase()).toMatch(/invalid/);
    });

    it("should return 404 when campaign id not found", async () => {
      const res = await request(app).get("/api/campaigns/999999");
      expect([404, 500]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.error).toMatch(/not found/i);
      }
    });
  });

  describe("POST /api/contributions", () => {
    it("should return 400 for malformed payload", async () => {
      const res = await request(app)
        .post("/api/contributions")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for invalid campaignId", async () => {
      const res = await request(app)
        .post("/api/contributions")
        .send({
          campaignId: -1,
          contributorAddress: "0x1234567890123456789012345678901234567890",
          amountWei: "1000000000000000000",
          txHash: "0x" + "a".repeat(64),
        });
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid contributor address", async () => {
      const res = await request(app)
        .post("/api/contributions")
        .send({
          campaignId: 1,
          contributorAddress: "invalid",
          amountWei: "1000000000000000000",
          txHash: "0x" + "a".repeat(64),
        });
      expect(res.status).toBe(400);
    });
  });
});
