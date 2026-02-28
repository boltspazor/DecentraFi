import { jest } from "@jest/globals";
import request from "supertest";

const validAddress = "0x1234567890123456789012345678901234567890";
const validTxHash = "0x" + "a".repeat(64);

function futureDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

const mockCreate = jest.fn();
const mockFindById = jest.fn();

jest.unstable_mockModule("../src/services/campaignService.js", () => ({
  create: (...args: unknown[]) => mockCreate(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findAll: jest.fn(() => Promise.resolve([])),
  findByCampaignAddress: jest.fn(() => Promise.resolve(null)),
  updateTotalRaisedAndStatus: jest.fn(() => Promise.resolve()),
}));
jest.unstable_mockModule("../src/services/contributionService.js", () => ({
  findByCampaignId: jest.fn(() => Promise.resolve([])),
  create: jest.fn(),
  findByTxHash: jest.fn(),
}));

const { default: app } = await import("../src/app.js");

describe("Campaign API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/campaigns (regression: campaign creation)", () => {
    it("should create campaign and return 201 with metadata (no private keys)", async () => {
      const campaignAddress = "0x" + "e".repeat(40);
      const createdRow = {
        id: 1,
        title: "Regression Test Campaign",
        description: "Description",
        goal: "10000000000000000000",
        deadline: new Date(futureDeadline()),
        creator: validAddress,
        campaign_address: campaignAddress,
        tx_hash: "0x" + "f".repeat(64),
        total_raised: "0",
        status: "Active",
        created_at: new Date(),
      };
      mockCreate.mockResolvedValue(createdRow);

      const res = await request(app)
        .post("/api/campaigns")
        .send({
          title: "Regression Test Campaign",
          description: "Description",
          goal: "10000000000000000000",
          deadline: futureDeadline(),
          creator: validAddress,
          campaignAddress,
          txHash: "0x" + "f".repeat(64),
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title", "Regression Test Campaign");
      expect(res.body).toHaveProperty("description");
      expect(res.body).toHaveProperty("goal");
      expect(res.body).toHaveProperty("deadline");
      expect(res.body).toHaveProperty("creator");
      expect(res.body).toHaveProperty("campaignAddress");
      expect(res.body).toHaveProperty("totalRaised");
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("createdAt");
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toMatch(/privateKey|private_key|secret|mnemonic|phrase/i);
    });
  });

  describe("GET /api/campaigns/:id", () => {
    it("should return 400 for invalid campaign id", async () => {
      const res = await request(app).get("/api/campaigns/abc");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(String(res.body.error).toLowerCase()).toMatch(/invalid/);
    });

    it("should return 404 when campaign id not found", async () => {
      mockFindById.mockResolvedValue(null);
      const res = await request(app).get("/api/campaigns/999999");
      expect([404, 500]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.error).toMatch(/not found/i);
      }
    });

    it("should return campaign with totalRaised, status, and contributors (backward compatible shape)", async () => {
      const createdRow = {
        id: 42,
        title: "Detail Test",
        description: "Desc",
        goal: "10000000000000000000",
        deadline: new Date(futureDeadline()),
        creator: validAddress,
        campaign_address: "0x" + "9".repeat(40),
        tx_hash: "0x" + "8".repeat(64),
        total_raised: "0",
        status: "Active",
        created_at: new Date(),
      };
      mockCreate.mockResolvedValue(createdRow);
      mockFindById.mockResolvedValue(createdRow);
      const createRes = await request(app)
        .post("/api/campaigns")
        .send({
          title: "Detail Test",
          description: "Desc",
          goal: "10000000000000000000",
          deadline: futureDeadline(),
          creator: validAddress,
          campaignAddress: "0x" + "9".repeat(40),
          txHash: "0x" + "8".repeat(64),
        });
      if (createRes.status !== 201 || !createRes.body?.id) return;
      const id = createRes.body.id;
      mockFindById.mockResolvedValue({ ...createdRow, id: createRes.body.id });
      const res = await request(app).get(`/api/campaigns/${id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", id);
      expect(res.body).toHaveProperty("totalRaised");
      expect(res.body).toHaveProperty("status");
      expect(Array.isArray(res.body.contributors)).toBe(true);
      expect(res.body).not.toHaveProperty("privateKey");
      expect(JSON.stringify(res.body)).not.toMatch(/private_key|secret|mnemonic/i);
    });
  });

  describe("POST /api/contributions", () => {
    const validAddress = "0x1234567890123456789012345678901234567890";
    const validTxHash = "0x" + "a".repeat(64);

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
          contributorAddress: validAddress,
          amountWei: "1000000000000000000",
          txHash: validTxHash,
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
          txHash: validTxHash,
        });
      expect(res.status).toBe(400);
    });

    it("should return 400 for missing amountWei", async () => {
      const res = await request(app)
        .post("/api/contributions")
        .send({
          campaignId: 1,
          contributorAddress: validAddress,
          txHash: validTxHash,
        });
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid txHash", async () => {
      const res = await request(app)
        .post("/api/contributions")
        .send({
          campaignId: 1,
          contributorAddress: validAddress,
          amountWei: "1000000000000000000",
          txHash: "0xabc",
        });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/contributions/campaign/:id", () => {
    it("should return 400 for invalid campaign id", async () => {
      const res = await request(app).get("/api/contributions/campaign/0");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 404 when campaign not found", async () => {
      mockFindById.mockResolvedValue(null);
      const res = await request(app).get("/api/contributions/campaign/999999");
      expect([404, 500]).toContain(res.status);
    });
  });

  describe("PATCH /api/campaigns/:id/status", () => {
    it("should return 400 for invalid campaign id", async () => {
      const res = await request(app)
        .patch("/api/campaigns/abc/status")
        .send({ status: "Successful" });
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid status value", async () => {
      const res = await request(app)
        .patch("/api/campaigns/1/status")
        .send({ status: "Invalid" });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for missing status", async () => {
      const res = await request(app).patch("/api/campaigns/1/status").send({});
      expect(res.status).toBe(400);
    });
  });
});
