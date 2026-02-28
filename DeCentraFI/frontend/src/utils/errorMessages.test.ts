import { describe, it, expect } from "vitest";
import { getTransactionErrorMessage, getConnectionErrorMessage } from "../utils/errorMessages";

describe("errorMessages", () => {
  describe("getTransactionErrorMessage", () => {
    it("returns user-friendly message for rejected transaction", () => {
      expect(getTransactionErrorMessage({ code: "ACTION_REJECTED" })).toMatch(/rejected/i);
      expect(getTransactionErrorMessage({ message: "User rejected the request" })).toMatch(/rejected/i);
    });

    it("returns message for zero contribution revert", () => {
      expect(getTransactionErrorMessage({ message: "ZeroContribution()" })).toMatch(/greater than zero/i);
    });

    it("returns message for refund not enabled", () => {
      expect(getTransactionErrorMessage({ message: "RefundNotEnabled()" })).toMatch(/refunds are not yet enabled/i);
    });

    it("returns message for deadline not reached", () => {
      expect(getTransactionErrorMessage({ message: "DeadlineNotReached()" })).toMatch(/before the campaign deadline/i);
    });

    it("returns message for already withdrawn", () => {
      expect(getTransactionErrorMessage({ message: "AlreadyWithdrawn()" })).toMatch(/already been withdrawn/i);
    });

    it("returns message for gas/revert errors", () => {
      expect(getTransactionErrorMessage({ message: "gas estimation failed" })).toMatch(/would fail|invalid/i);
      expect(getTransactionErrorMessage({ message: "execution reverted" })).toMatch(/would fail|invalid/i);
    });

    it("returns fallback for unknown error", () => {
      expect(getTransactionErrorMessage(null)).toBe("Transaction failed");
      expect(getTransactionErrorMessage(undefined)).toBe("Transaction failed");
    });
  });

  describe("getConnectionErrorMessage", () => {
    it("returns message for rejected connection", () => {
      expect(getConnectionErrorMessage({ message: "User denied" })).toMatch(/rejected|denied/i);
    });

    it("returns message for no provider", () => {
      expect(getConnectionErrorMessage({ message: "No Ethereum provider" })).toMatch(/wallet|MetaMask/i);
    });
  });
});
