import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CampaignExplorePage } from "./CampaignExplore";

vi.mock("../services/api", () => {
  return {
    searchCampaigns: vi.fn(),
  };
});

import { searchCampaigns } from "../services/api";

function renderExplore(initialEntries: string[] = ["/explore"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/explore" element={<CampaignExplorePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CampaignExplorePage (search & filters)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(searchCampaigns).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
    });
  });

  it("renders search bar, filters, and empty state", async () => {
    renderExplore();
    expect(screen.getByLabelText(/keyword/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/min goal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max goal/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(searchCampaigns).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/no campaigns match your filters/i)).toBeInTheDocument();
    });
  });

  it("sends keyword and status filters to the API on search", async () => {
    renderExplore();

    await waitFor(() => {
      expect(searchCampaigns).toHaveBeenCalled();
    });

    vi.mocked(searchCampaigns).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
    });

    fireEvent.change(screen.getByLabelText(/keyword/i), {
      target: { value: "education" },
    });
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "Successful" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => {
      expect(searchCampaigns).toHaveBeenCalled();
    });
    const calls = vi.mocked(searchCampaigns).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const lastCall = calls[calls.length - 1];
    const args = lastCall?.[0];
    expect(args?.q).toBe("education");
    expect(args?.status).toBe("Successful");
  });

  it("shows campaigns as cards and supports pagination controls", async () => {
    vi.mocked(searchCampaigns).mockResolvedValue({
      items: [
        {
          id: 1,
          title: "Education for All",
          description: "Supporting education",
          goal: "5000000000000000000",
          deadline: new Date().toISOString(),
          creator: "0x1234567890123456789012345678901234567890",
          campaignAddress: "0xcampaign",
          txHash: null,
          totalRaised: "1000000000000000000",
          status: "Active",
          createdAt: new Date().toISOString(),
        },
      ],
      total: 25,
      page: 1,
      pageSize: 12,
    });

    renderExplore();

    await waitFor(() => {
      expect(screen.getByText(/education for all/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/goal\s+5/i)).toBeInTheDocument();
    expect(screen.getByText(/raised\s+1/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("calls API with next page when clicking pagination next", async () => {
    vi.mocked(searchCampaigns).mockResolvedValue({
      items: [
        {
          id: 1,
          title: "Campaign 1",
          description: "",
          goal: "1000000000000000000",
          deadline: new Date().toISOString(),
          creator: "0x1234567890123456789012345678901234567890",
          campaignAddress: "0xcampaign1",
          txHash: null,
          totalRaised: "0",
          status: "Active",
          createdAt: new Date().toISOString(),
        },
      ],
      total: 20,
      page: 1,
      pageSize: 12,
    });

    renderExplore();

    await waitFor(() => {
      expect(searchCampaigns).toHaveBeenCalled();
    });

    vi.mocked(searchCampaigns).mockResolvedValueOnce({
      items: [],
      total: 20,
      page: 2,
      pageSize: 12,
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(searchCampaigns).toHaveBeenCalledTimes(2);
    });
    const secondCall = vi.mocked(searchCampaigns).mock.calls[1];
    const args = secondCall?.[0];
    expect(args?.page).toBe(2);
  });
});

