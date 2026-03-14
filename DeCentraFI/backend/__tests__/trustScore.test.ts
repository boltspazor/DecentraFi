/**
 * Unit tests for trust score calculation (mocked DB).
 * Formula: trustScore = (successfulCampaigns * 2) - failedCampaigns, clamped 0–10.
 */
import { jest } from "@jest/globals";

const mockQuery = jest.fn();

jest.unstable_mockModule("../src/config/db.js", () => ({
  pool: { query: mockQuery },
}));

const campaignService = await import("../src/services/campaignService.js");

describe("getCreatorTrustScore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates trust score correctly: (successful * 2) - failed", async () => {
    mockQuery.mockResolvedValue({ rows: [{ successful: 4, failed: 2 }] });
    const result = await campaignService.getCreatorTrustScore("0xcreator");
    expect(result.trustScore).toBe(6);
    expect(result.successfulCampaigns).toBe(4);
    expect(result.failedCampaigns).toBe(2);
  });

  it("returns 0 for creator with no successful or failed campaigns", async () => {
    mockQuery.mockResolvedValue({ rows: [{ successful: 0, failed: 0 }] });
    const result = await campaignService.getCreatorTrustScore("0xnewcreator");
    expect(result.trustScore).toBe(0);
    expect(result.successfulCampaigns).toBe(0);
    expect(result.failedCampaigns).toBe(0);
  });

  it("clamps to 0 when creator has only failed campaigns (negative raw score)", async () => {
    mockQuery.mockResolvedValue({ rows: [{ successful: 0, failed: 3 }] });
    const result = await campaignService.getCreatorTrustScore("0xbadcreator");
    expect(result.trustScore).toBe(0);
    expect(result.successfulCampaigns).toBe(0);
    expect(result.failedCampaigns).toBe(3);
  });

  it("clamps to 10 when raw score exceeds 10", async () => {
    mockQuery.mockResolvedValue({ rows: [{ successful: 10, failed: 0 }] });
    const result = await campaignService.getCreatorTrustScore("0xstarcreator");
    expect(result.trustScore).toBe(10);
    expect(result.successfulCampaigns).toBe(10);
    expect(result.failedCampaigns).toBe(0);
  });

  it("creator with refunds (failed campaigns) reduces score", async () => {
    mockQuery.mockResolvedValue({ rows: [{ successful: 2, failed: 2 }] });
    const result = await campaignService.getCreatorTrustScore("0xrefunded");
    expect(result.trustScore).toBe(2);
    expect(result.failedCampaigns).toBe(2);
  });

  it("normalizes creator address to lowercase for query", async () => {
    mockQuery.mockResolvedValue({ rows: [{ successful: 1, failed: 0 }] });
    await campaignService.getCreatorTrustScore("0xABC");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("LOWER(creator)"),
      ["0xabc"]
    );
  });
});
