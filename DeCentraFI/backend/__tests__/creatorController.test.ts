import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";

// ESM jest mocking: mock modules BEFORE importing the router/controller.
const mockCreatorProfileService = {
  getProfile: jest.fn(),
  upsertProfile: jest.fn(),
  setVerified: jest.fn(),
};
const mockCampaignService = {
  getCreatorTrustScore: jest.fn(),
  searchCampaigns: jest.fn(),
};

jest.unstable_mockModule("../src/services/creatorProfileService.js", () => mockCreatorProfileService);
jest.unstable_mockModule("../src/services/campaignService.js", () => mockCampaignService);

const { default: creatorRoutes } = await import("../src/routes/creatorRoutes.js");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/creators", creatorRoutes);
  return app;
}

describe("Creator DID endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("DID linked correctly: stores and returns DID refs", async () => {
    mockCreatorProfileService.upsertProfile.mockResolvedValue({
      wallet: "0xabc0000000000000000000000000000000000000",
      ens_name: "alice.eth",
      lens_handle: "alice.lens",
      ceramic_did: "did:3:kjzl6cwe1jw147",
      is_verified: false,
      updated_at: new Date(),
      created_at: new Date(),
    });

    const app = makeApp();
    const res = await request(app)
      .put("/api/creators/0xAbC0000000000000000000000000000000000000")
      .send({
        ensName: "alice.eth",
        lensHandle: "alice.lens",
        ceramicDid: "did:3:kjzl6cwe1jw147",
      });

    expect(res.status).toBe(200);
    expect(res.body.wallet).toBe("0xabc0000000000000000000000000000000000000");
    expect(res.body.ensName).toBe("alice.eth");
    expect(res.body.lensHandle).toBe("alice.lens");
    expect(res.body.ceramicDid).toBe("did:3:kjzl6cwe1jw147");
  });

  test("Reputation updates after campaigns: profile endpoint returns trust score from service", async () => {
    mockCreatorProfileService.getProfile.mockResolvedValue(null);
    mockCampaignService.getCreatorTrustScore.mockResolvedValue({
      trustScore: 7,
      successfulCampaigns: 4,
      failedCampaigns: 1,
    });

    const app = makeApp();
    const res = await request(app).get("/api/creators/0xabc0000000000000000000000000000000000000");

    expect(res.status).toBe(200);
    expect(res.body.trustScore).toBe(7);
    expect(res.body.successfulCampaigns).toBe(4);
    expect(res.body.failedCampaigns).toBe(1);
    expect(mockCampaignService.getCreatorTrustScore).toHaveBeenCalledWith(
      "0xabc0000000000000000000000000000000000000"
    );
  });

  test("Edge case: new user (no history) returns empty campaigns", async () => {
    mockCampaignService.searchCampaigns.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    const app = makeApp();
    const res = await request(app).get("/api/creators/0xabc0000000000000000000000000000000000000/history");
    expect(res.status).toBe(200);
    expect(res.body.wallet).toBe("0xabc0000000000000000000000000000000000000");
    expect(Array.isArray(res.body.campaigns)).toBe(true);
    expect(res.body.campaigns).toHaveLength(0);
  });

  test("Edge case: missing profile data returns null DID fields + unverified", async () => {
    mockCreatorProfileService.getProfile.mockResolvedValue(null);
    mockCampaignService.getCreatorTrustScore.mockResolvedValue({
      trustScore: 0,
      successfulCampaigns: 0,
      failedCampaigns: 0,
    });
    const app = makeApp();
    const res = await request(app).get("/api/creators/0xabc0000000000000000000000000000000000000");
    expect(res.status).toBe(200);
    expect(res.body.ensName).toBeNull();
    expect(res.body.lensHandle).toBeNull();
    expect(res.body.ceramicDid).toBeNull();
    expect(res.body.isVerified).toBe(false);
  });

  test("Edge case: invalid DID rejected (ceramicDid)", async () => {
    const app = makeApp();
    const res = await request(app)
      .put("/api/creators/0xabc0000000000000000000000000000000000000")
      .send({ ceramicDid: "not-a-did" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid Ceramic DID/i);
    expect(mockCreatorProfileService.upsertProfile).not.toHaveBeenCalled();
  });
});

