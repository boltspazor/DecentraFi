import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "./Dashboard";

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
  })),
}));

vi.mock("../services/api", () => ({
  getUserContributions: vi.fn(),
}));

vi.mock("../services/campaignContract", () => ({
  useCampaign: vi.fn(() => ({
    goal: 10000000000000000000n,
    totalRaised: 3000000000000000000n,
    totalContributed: 3000000000000000000n,
    refundEnabled: false,
    myContribution: 1000000000000000000n,
  })),
}));

import { useAccount } from "wagmi";
import { getUserContributions } from "../services/api";

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
  });

  it("renders dashboard correctly when connected", async () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: /your dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/overview of campaigns you have contributed to/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(getUserContributions).toHaveBeenCalledWith("0x1234567890123456789012345678901234567890");
    });
  });

  it("shows empty state when user has no contributions", async () => {
    vi.mocked(getUserContributions).mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/you have not contributed to any campaigns yet/i)).toBeInTheDocument();
    });
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
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
    } as never);
    renderDashboard();
    expect(screen.getByRole("heading", { name: /your dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/connect your wallet to view campaigns you have funded/i)).toBeInTheDocument();
    expect(getUserContributions).not.toHaveBeenCalled();
  });
});
