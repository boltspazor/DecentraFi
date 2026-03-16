import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "./Dashboard";
import type { CampaignEventHandlers } from "../services/campaignEvents";

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
  })),
}));

vi.mock("../services/api", () => ({
  getUserContributions: vi.fn(),
  getUserNfts: vi.fn(),
}));

const refetchCampaignMock = vi.fn();
vi.mock("../services/campaignContract", () => ({
  useCampaign: vi.fn(() => ({
    goal: 10000000000000000000n,
    totalRaised: 3000000000000000000n,
    totalContributed: 3000000000000000000n,
    refundEnabled: false,
    myContribution: 1000000000000000000n,
    refetch: refetchCampaignMock,
  })),
}));

let capturedEventHandlers: CampaignEventHandlers = {};
vi.mock("../services/campaignEvents", () => ({
  useCampaignEvents: vi.fn((_addr: string, handlers: CampaignEventHandlers) => {
    capturedEventHandlers = handlers;
  }),
}));

import { useAccount } from "wagmi";
import { getUserContributions, getUserNfts } from "../services/api";
import { useCampaign } from "../services/campaignContract";

function renderDashboard(initialEntries: string[] = ["/dashboard"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.mocked(useAccount).mockReturnValue({
      address: "0x1234567890123456789012345678901234567890",
      isConnected: true,
    } as never);
    vi.mocked(getUserContributions).mockResolvedValue([]);
    vi.mocked(getUserNfts).mockResolvedValue([]);
    refetchCampaignMock.mockClear();
    capturedEventHandlers = {};
  });

  it("renders dashboard correctly when connected", async () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: /your dashboard/i })).toBeInTheDocument();
    expect(
      screen.getByText(/overview of campaigns you have contributed to and your supporter badge nfts/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(getUserContributions).toHaveBeenCalledWith("0x1234567890123456789012345678901234567890");
    });
  });

  it("shows empty state when user has no contributions", async () => {
    vi.mocked(getUserContributions).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByText(/you have not contributed to any campaigns yet/i)
      ).toBeInTheDocument();
    });
  });

  it("shows empty NFT state when user has no supporter NFTs", async () => {
    vi.mocked(getUserContributions).mockResolvedValue([]);
    vi.mocked(getUserNfts).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByText(/you do not have any supporter badge nfts yet/i)
      ).toBeInTheDocument();
    });
  });

  it("renders NFT gallery with metadata when user has NFTs", async () => {
    vi.mocked(getUserContributions).mockResolvedValue([]);
    vi.mocked(getUserNfts).mockResolvedValue([
      {
        tokenId: 1,
        campaignId: 42,
        contributorWallet: "0x1234567890123456789012345678901234567890",
        nftLevel: "Gold",
        ipfsHash: "QmHash",
        createdAt: new Date().toISOString(),
      },
    ] as never);
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByText(/gold supporter badge • token #1/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/campaign id:/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view nft/i })).toBeInTheDocument();
  });

  it("shows contribution list when user has contributions", async () => {
    vi.mocked(getUserContributions).mockResolvedValue([
      {
        campaignId: 1,
        title: "My Funded Campaign",
        status: "Active",
        campaignAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        amountWei: "1000000000000000000",
        createdAt: new Date().toISOString(),
      },
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/my funded campaign/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Contributed: 1\.0000 ETH/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toBeInTheDocument();
  });

  it("shows connect wallet message when not connected", () => {
    vi.mocked(getUserContributions).mockClear();
    vi.mocked(getUserNfts).mockClear();
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
    } as never);
    renderDashboard();
    expect(screen.getByRole("heading", { name: /your dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/connect your wallet to view campaigns you have funded/i)).toBeInTheDocument();
    expect(getUserContributions).not.toHaveBeenCalled();
    expect(getUserNfts).not.toHaveBeenCalled();
  });

  describe("event-driven updates", () => {
    const oneContribution = [
      {
        campaignId: 1,
        title: "Event Test Campaign",
        status: "Active",
        campaignAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        amountWei: "1000000000000000000",
        createdAt: new Date().toISOString(),
      },
    ];

    it("progress bar shows percentage from contract state", async () => {
      vi.mocked(useCampaign).mockReturnValue({
        goal: 10000000000000000000n,
        totalRaised: 3000000000000000000n,
        totalContributed: 3000000000000000000n,
        refundEnabled: false,
        myContribution: 1000000000000000000n,
        refetch: refetchCampaignMock,
      } as never);
      vi.mocked(getUserContributions).mockResolvedValue(oneContribution);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/event test campaign/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Progress: 30%/)).toBeInTheDocument();
    });

    it("ContributionReceived event triggers refetch so contribution list can update", async () => {
      vi.mocked(getUserContributions).mockResolvedValue(oneContribution);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/event test campaign/i)).toBeInTheDocument();
      });
      expect(refetchCampaignMock).not.toHaveBeenCalled();
      capturedEventHandlers.onContributionReceived?.({ contributor: "0xa", amountWei: 1000n, txHash: "0x1" });
      expect(refetchCampaignMock).toHaveBeenCalledTimes(1);
    });

    it("shows Refund eligible when refundEnabled and myContribution > 0", async () => {
      vi.mocked(useCampaign).mockReturnValue({
        goal: 10000000000000000000n,
        totalRaised: 5000000000000000000n,
        totalContributed: 5000000000000000000n,
        refundEnabled: true,
        myContribution: 1000000000000000000n,
        refetch: refetchCampaignMock,
      } as never);
      vi.mocked(getUserContributions).mockResolvedValue(oneContribution);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/refund eligible/i)).toBeInTheDocument();
      });
    });

    it("shows Refund not available when refund not enabled", async () => {
      vi.mocked(useCampaign).mockReturnValue({
        goal: 10000000000000000000n,
        totalRaised: 3000000000000000000n,
        totalContributed: 3000000000000000000n,
        refundEnabled: false,
        myContribution: 1000000000000000000n,
        refetch: refetchCampaignMock,
      } as never);
      vi.mocked(getUserContributions).mockResolvedValue(oneContribution);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/refund not available/i)).toBeInTheDocument();
      });
    });

    it("FundsReleased and RefundClaimed events trigger refetch for withdraw/refund UI", async () => {
      vi.mocked(getUserContributions).mockResolvedValue(oneContribution);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/event test campaign/i)).toBeInTheDocument();
      });
      refetchCampaignMock.mockClear();
      capturedEventHandlers.onFundsReleased?.({ creator: "0xc", amountWei: 5000n, txHash: "0x2" });
      capturedEventHandlers.onRefundClaimed?.({ contributor: "0xd", amountWei: 1000n, txHash: "0x3" });
      expect(refetchCampaignMock).toHaveBeenCalledTimes(2);
    });

    it("duplicate events call refetch each time", async () => {
      vi.mocked(getUserContributions).mockResolvedValue(oneContribution);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/event test campaign/i)).toBeInTheDocument();
      });
      refetchCampaignMock.mockClear();
      capturedEventHandlers.onContributionReceived?.({ contributor: "0xa", amountWei: 100n, txHash: "0x1" });
      capturedEventHandlers.onContributionReceived?.({ contributor: "0xa", amountWei: 100n, txHash: "0x1" });
      expect(refetchCampaignMock).toHaveBeenCalledTimes(2);
    });
  });
});
