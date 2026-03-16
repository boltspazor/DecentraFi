import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { WalletConnectButton } from "./WalletConnectButton";

vi.mock("../config/wagmiConfig", () => ({
  supportedChains: [
    { id: 1, name: "Ethereum" },
    { id: 137, name: "Polygon" },
    { id: 42161, name: "Arbitrum" },
    { id: 11155111, name: "Sepolia" },
  ],
}));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
    chainId: 11155111,
  })),
  useConnect: vi.fn(() => ({ connect: vi.fn(), connectors: [{ uid: "1", name: "MetaMask" }], isPending: false, error: null })),
  useDisconnect: vi.fn(() => ({ disconnect: vi.fn() })),
  useSwitchChain: vi.fn(() => ({ switchChain: vi.fn(), isPending: false })),
}));

describe("WalletConnectButton (regression: wallet auth)", () => {
  it("shows truncated address when connected", () => {
    render(<WalletConnectButton />);
    const addressEl = document.querySelector('[title="0x1234567890123456789012345678901234567890"]');
    expect(addressEl).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("shows Disconnect button when connected", () => {
    render(<WalletConnectButton />);
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("shows current chain name when connected (Sepolia)", () => {
    render(<WalletConnectButton />);
    expect(screen.getByRole("button", { name: /sepolia/i })).toBeInTheDocument();
  });
});

describe("WalletConnectButton when wrong network", () => {
  it("shows network selector with styled button when chainId is not supported", async () => {
    const { useAccount, useSwitchChain } = await import("wagmi");
    vi.mocked(useAccount).mockReturnValue({
      address: "0x1234567890123456789012345678901234567890",
      isConnected: true,
      chainId: 999,
    } as never);
    vi.mocked(useSwitchChain).mockReturnValue({ switchChain: vi.fn(), isPending: false } as never);
    render(<WalletConnectButton />);
    expect(screen.getByRole("button", { name: /chain 999/i })).toBeInTheDocument();
  });

  it("network switching: clicking a chain calls switchChain with that chainId", async () => {
    const { useAccount, useSwitchChain } = await import("wagmi");
    const mockSwitchChain = vi.fn();
    vi.mocked(useAccount).mockReturnValue({
      address: "0x1234567890123456789012345678901234567890",
      isConnected: true,
      chainId: 999,
    } as never);
    vi.mocked(useSwitchChain).mockReturnValue({ switchChain: mockSwitchChain, isPending: false } as never);
    render(<WalletConnectButton />);
    await act(async () => {
      screen.getByRole("button", { name: /chain 999/i }).click();
    });
    const ethereumOption = await screen.findByRole("button", { name: /^Ethereum$/i });
    await act(async () => {
      ethereumOption.click();
    });
    expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 1 });
  });
});
