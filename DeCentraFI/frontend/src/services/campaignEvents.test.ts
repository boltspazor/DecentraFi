import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { ethers } from "ethers";
import { useCampaignEvents } from "./campaignEvents";

const mockContractOn = vi.fn();
const mockContractOff = vi.fn();
const mockProviderDestroy = vi.fn();

vi.mock("ethers", () => ({
  ethers: {
    WebSocketProvider: vi.fn(function (this: unknown) {
      return { destroy: mockProviderDestroy };
    }),
    Contract: vi.fn(function (this: unknown) {
      return {
        on: mockContractOn,
        off: mockContractOff,
      };
    }),
  },
}));

const campaignAddress = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as `0x${string}`;

describe("useCampaignEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_WS_RPC_URL", "wss://test.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not subscribe when VITE_WS_RPC_URL is not set", () => {
    vi.stubEnv("VITE_WS_RPC_URL", "");
    const onContribution = vi.fn();
    renderHook(() =>
      useCampaignEvents(campaignAddress, { onContributionReceived: onContribution })
    );
    expect(mockContractOn).not.toHaveBeenCalled();
  });

  it("subscribes to ContributionReceived, FundsReleased, RefundClaimed when WS URL is set", () => {
    renderHook(() =>
      useCampaignEvents(campaignAddress, {
        onContributionReceived: vi.fn(),
        onFundsReleased: vi.fn(),
        onRefundClaimed: vi.fn(),
      })
    );
    expect(mockContractOn).toHaveBeenCalledWith("ContributionReceived", expect.any(Function));
    expect(mockContractOn).toHaveBeenCalledWith("FundsReleased", expect.any(Function));
    expect(mockContractOn).toHaveBeenCalledWith("RefundClaimed", expect.any(Function));
  });

  it("cleans up listeners and provider on unmount", () => {
    const { unmount } = renderHook(() =>
      useCampaignEvents(campaignAddress, {
        onContributionReceived: vi.fn(),
        onFundsReleased: vi.fn(),
        onRefundClaimed: vi.fn(),
      })
    );
    unmount();
    expect(mockContractOff).toHaveBeenCalledWith("ContributionReceived", expect.any(Function));
    expect(mockContractOff).toHaveBeenCalledWith("FundsReleased", expect.any(Function));
    expect(mockContractOff).toHaveBeenCalledWith("RefundClaimed", expect.any(Function));
    expect(mockProviderDestroy).toHaveBeenCalled();
  });

  it("does not call handler when event fires after unmount (event delay)", async () => {
    const onContribution = vi.fn();
    const { unmount } = renderHook(() =>
      useCampaignEvents(campaignAddress, { onContributionReceived: onContribution })
    );
    const contributionListener = mockContractOn.mock.calls.find(
      (c: unknown[]) => c[0] === "ContributionReceived"
    )?.[1] as (contributor: string, amount: bigint, event: { transactionHash: string }) => void;
    expect(contributionListener).toBeDefined();

    unmount();

    contributionListener("0xabc", 1000n, { transactionHash: "0xtx" });
    expect(onContribution).not.toHaveBeenCalled();
  });

  it("calls handler when event fires while mounted", async () => {
    const onContribution = vi.fn();
    renderHook(() =>
      useCampaignEvents(campaignAddress, { onContributionReceived: onContribution })
    );
    const contributionListener = mockContractOn.mock.calls.find(
      (c: unknown[]) => c[0] === "ContributionReceived"
    )?.[1] as (contributor: string, amount: bigint, event: { transactionHash: string }) => void;

    contributionListener("0xcontributor", 1000000000000000000n, { transactionHash: "0xhash" });

    expect(onContribution).toHaveBeenCalledTimes(1);
    expect(onContribution).toHaveBeenCalledWith({
      contributor: "0xcontributor",
      amountWei: 1000000000000000000n,
      txHash: "0xhash",
    });
  });

  it("handles duplicate events by calling handler each time", () => {
    const onContribution = vi.fn();
    renderHook(() =>
      useCampaignEvents(campaignAddress, { onContributionReceived: onContribution })
    );
    const contributionListener = mockContractOn.mock.calls.find(
      (c: unknown[]) => c[0] === "ContributionReceived"
    )?.[1] as (contributor: string, amount: bigint, event: { transactionHash: string }) => void;

    contributionListener("0xa", 100n, { transactionHash: "0x1" });
    contributionListener("0xb", 200n, { transactionHash: "0x2" });

    expect(onContribution).toHaveBeenCalledTimes(2);
    expect(onContribution).toHaveBeenNthCalledWith(1, {
      contributor: "0xa",
      amountWei: 100n,
      txHash: "0x1",
    });
    expect(onContribution).toHaveBeenNthCalledWith(2, {
      contributor: "0xb",
      amountWei: 200n,
      txHash: "0x2",
    });
  });

  it("does not throw when provider creation fails (websocket disconnect scenario)", async () => {
    const { ethers } = await import("ethers");
    vi.mocked(ethers.WebSocketProvider).mockImplementationOnce(() => {
      throw new Error("WebSocket connection failed");
    });
    const onContribution = vi.fn();
    expect(() =>
      renderHook(() =>
        useCampaignEvents(campaignAddress, { onContributionReceived: onContribution })
      )
    ).not.toThrow();
    expect(mockContractOn).not.toHaveBeenCalled();
  });
});
