import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CampaignDetail } from "../pages/CampaignDetail";

const mockCampaignMeta = {
  id: 1,
  title: "Test Campaign",
  description: "Description",
  goal: "10000000000000000000",
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  creator: "0xcreator0000000000000000000000000000000001",
  campaignAddress: "0xcampaign000000000000000000000000000000001",
  totalRaised: "0",
  status: "Active",
  createdAt: new Date().toISOString(),
};

const mockContributions: { id: number; campaignId: number; contributorAddress: string; amountWei: string; txHash: string; createdAt: string }[] = [];

vi.mock("../services/api", () => ({
  getCampaign: vi.fn(),
  getContributionsByCampaign: vi.fn(),
  postContribution: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0xuser0000000000000000000000000000000001",
    isConnected: true,
    chainId: 11155111,
  })),
  useSwitchChain: vi.fn(() => ({ switchChain: vi.fn() })),
}));

vi.mock("../services/campaignContract", () => ({
  useCampaign: vi.fn(() => ({
    goal: BigInt("10000000000000000000"),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
    totalContributed: 0n,
    closed: false,
    fundsWithdrawn: false,
    creator: "0xcreator0000000000000000000000000000000001",
    refetch: vi.fn(),
  })),
  useContribute: vi.fn(() => ({
    contribute: vi.fn(),
    isPending: false,
    isSuccess: false,
    hash: undefined,
    error: null,
    reset: vi.fn(),
    contributorAddress: "0xuser0000000000000000000000000000000001",
  })),
  useWithdraw: vi.fn(() => ({
    withdrawFunds: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  })),
}));

import * as api from "../services/api";

function renderCampaignDetail(id = "1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/campaigns/${id}`]}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CampaignDetail", () => {
  beforeEach(() => {
    vi.mocked(api.getCampaign).mockResolvedValue(mockCampaignMeta as never);
    vi.mocked(api.getContributionsByCampaign).mockResolvedValue(mockContributions as never);
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(api.getCampaign).mockImplementation(() => new Promise(() => {}));
    renderCampaignDetail();
    expect(screen.getByText(/loading campaign/i)).toBeInTheDocument();
  });

  it("shows campaign title and description after load", async () => {
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /test campaign/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("shows progress bar and percentage", async () => {
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByText(/goal:/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/0% funded/)).toBeInTheDocument();
  });

  it("rejects zero amount and shows error", async () => {
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByLabelText(/amount \(eth\)/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/amount \(eth\)/i);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /contribute/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid amount greater than zero/i)).toBeInTheDocument();
    });
  });

  it("rejects negative amount", async () => {
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByLabelText(/amount \(eth\)/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/amount \(eth\)/i);
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: /contribute/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid amount greater than zero/i)).toBeInTheDocument();
    });
  });

  it("rejects invalid number", async () => {
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByLabelText(/amount \(eth\)/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/amount \(eth\)/i);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /contribute/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid amount greater than zero/i)).toBeInTheDocument();
    });
  });

  it("does not show withdraw button when user is not creator", async () => {
    const { useCampaign } = await import("../services/campaignContract");
    vi.mocked(useCampaign).mockReturnValue({
      goal: BigInt("10000000000000000000"),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
      totalContributed: 0n,
      closed: false,
      fundsWithdrawn: false,
      creator: "0xanothercreator00000000000000000000000000",
      refetch: vi.fn(),
    } as never);
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /test campaign/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /withdraw funds/i })).not.toBeInTheDocument();
  });

  it("shows withdraw button only when creator and goal reached and not withdrawn", async () => {
    const { useCampaign } = await import("../services/campaignContract");
    vi.mocked(useCampaign).mockReturnValue({
      goal: BigInt("10000000000000000000"),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
      totalContributed: BigInt("10000000000000000000"),
      closed: true,
      fundsWithdrawn: false,
      creator: "0xuser0000000000000000000000000000000001",
      refetch: vi.fn(),
    } as never);
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /withdraw funds/i })).toBeInTheDocument();
    });
  });

  it("progress bar shows correct percentage when totalRaised is half of goal", async () => {
    const { useCampaign } = await import("../services/campaignContract");
    vi.mocked(useCampaign).mockReturnValue({
      goal: BigInt("10000000000000000000"),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
      totalContributed: BigInt("5000000000000000000"),
      closed: false,
      fundsWithdrawn: false,
      creator: "0xcreator0000000000000000000000000000000001",
      refetch: vi.fn(),
    } as never);
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByText(/50% funded/)).toBeInTheDocument();
    });
  });

  it("shows error when campaign load fails", async () => {
    vi.mocked(api.getCampaign).mockRejectedValue(new Error("Network error"));
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByText(/network error|failed to load|campaign not found/i)).toBeInTheDocument();
    });
  });

  it("shows fallback when campaign not found", async () => {
    vi.mocked(api.getCampaign).mockRejectedValue(new Error("Not found"));
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByText(/back to campaigns/i)).toBeInTheDocument();
    });
  });

  it("contribute button is disabled when pending", async () => {
    const { useContribute } = await import("../services/campaignContract");
    vi.mocked(useContribute).mockReturnValue({
      contribute: vi.fn(),
      isPending: true,
      isSuccess: false,
      hash: undefined,
      error: null,
      reset: vi.fn(),
      contributorAddress: "0xuser0000000000000000000000000000000001",
    } as never);
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm in wallet/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /confirm in wallet/i })).toBeDisabled();
  });

  it("displays transaction error from wallet", async () => {
    const { useContribute } = await import("../services/campaignContract");
    vi.mocked(useContribute).mockReturnValue({
      contribute: vi.fn(),
      isPending: false,
      isSuccess: false,
      hash: undefined,
      error: { message: "User rejected the request" },
      reset: vi.fn(),
      contributorAddress: "0xuser0000000000000000000000000000000001",
    } as never);
    renderCampaignDetail();
    await waitFor(() => {
      expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    });
  });
});
