import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateCampaign } from "./CreateCampaign";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0xuser0000000000000000000000000000000001",
    isConnected: true,
    chainId: 11155111,
  })),
  useChainId: vi.fn(() => 11155111),
  useBalance: vi.fn(() => ({ data: undefined, isLoading: false })),
  useSwitchChain: vi.fn(() => ({ switchChain: vi.fn(), isPending: false })),
}));

const mockCreateOnChain = vi.fn();
vi.mock("../services/blockchain", () => ({
  useCampaignFactory: vi.fn(() => ({
    createCampaign: mockCreateOnChain,
    isPending: false,
    isSuccess: false,
    hash: undefined,
    getCampaignAddressFromReceipt: vi.fn(() => "0xcampaign000000000000000000000000000000001"),
    error: null,
    reset: vi.fn(),
  })),
}));

vi.mock("../services/api", () => ({
  createCampaign: vi.fn(() => Promise.resolve({ id: 1 })),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

import * as api from "../services/api";

function renderCreateCampaign() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CreateCampaign />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CreateCampaign (regression: campaign creation)", () => {
  beforeEach(() => {
    mockCreateOnChain.mockClear();
    mockNavigate.mockClear();
    vi.mocked(api.createCampaign).mockResolvedValue({ id: 1 } as never);
  });

  it("renders create campaign form and title", () => {
    renderCreateCampaign();
    expect(screen.getByRole("heading", { name: /create campaign/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/campaign title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/describe your campaign/i)).toBeInTheDocument();
  });

  it("does not expose private key or mnemonic in UI", () => {
    renderCreateCampaign();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/privateKey|private_key|mnemonic|secret phrase/i);
  });

  it("shows connect wallet message when not connected", async () => {
    const { useAccount } = await import("wagmi");
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
      chainId: undefined,
    } as never);
    renderCreateCampaign();
    expect(screen.getByText(/connect your wallet to create/i)).toBeInTheDocument();
  });
});
