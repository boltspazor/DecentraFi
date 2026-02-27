/**
 * Unit tests for contribution and status validation.
 * No database required.
 */
import { validateContributionBody, validatePatchStatusBody } from "../src/validation/contributionValidation.js";

describe("contributionValidation", () => {
  const validAddress = "0x1234567890123456789012345678901234567890";
  const validTxHash = "0x" + "a".repeat(64);

  describe("validateContributionBody", () => {
    it("should accept valid payload (blockchain-confirmed metadata only)", () => {
      const result = validateContributionBody({
        campaignId: 1,
        contributorAddress: validAddress,
        amountWei: "1000000000000000000",
        txHash: validTxHash,
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.campaignId).toBe(1);
        expect(result.data.contributorAddress).toBe(validAddress.toLowerCase());
        expect(result.data.amountWei).toBe("1000000000000000000");
        expect(result.data.txHash).toBe(validTxHash);
      }
    });

    it("should return 400 for missing campaignId", () => {
      const result = validateContributionBody({
        contributorAddress: validAddress,
        amountWei: "1000000000000000000",
        txHash: validTxHash,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.statusCode).toBe(400);
        expect(result.error).toMatch(/campaignId/i);
      }
    });

    it("should return 400 for invalid campaignId (zero or negative)", () => {
      expect(validateContributionBody({ campaignId: 0, contributorAddress: validAddress, amountWei: "1", txHash: validTxHash }).valid).toBe(false);
      expect(validateContributionBody({ campaignId: -1, contributorAddress: validAddress, amountWei: "1", txHash: validTxHash }).valid).toBe(false);
    });

    it("should return 400 for invalid contributor address", () => {
      const result = validateContributionBody({
        campaignId: 1,
        contributorAddress: "not-an-address",
        amountWei: "1000000000000000000",
        txHash: validTxHash,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(400);
    });

    it("should return 400 for missing or zero amountWei", () => {
      let result = validateContributionBody({
        campaignId: 1,
        contributorAddress: validAddress,
        txHash: validTxHash,
      });
      expect(result.valid).toBe(false);

      result = validateContributionBody({
        campaignId: 1,
        contributorAddress: validAddress,
        amountWei: "0",
        txHash: validTxHash,
      });
      expect(result.valid).toBe(false);
    });

    it("should return 400 for invalid txHash", () => {
      const result = validateContributionBody({
        campaignId: 1,
        contributorAddress: validAddress,
        amountWei: "1000000000000000000",
        txHash: "short",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(400);
    });

    it("should reject malformed payload (empty object)", () => {
      const result = validateContributionBody({});
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(400);
    });
  });

  describe("validatePatchStatusBody", () => {
    it("should accept Active, Successful, Failed", () => {
      expect(validatePatchStatusBody({ status: "Active" }).valid).toBe(true);
      expect(validatePatchStatusBody({ status: "Successful" }).valid).toBe(true);
      expect(validatePatchStatusBody({ status: "Failed" }).valid).toBe(true);
    });

    it("should return 400 for missing status", () => {
      const result = validatePatchStatusBody({});
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(400);
    });

    it("should return 400 for invalid status value", () => {
      const result = validatePatchStatusBody({ status: "Invalid" });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/Active|Successful|Failed/);
    });
  });
});
