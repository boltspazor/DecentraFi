import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WalletConnectButton } from "./WalletConnectButton";

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

  it("does not show Switch to Sepolia when on correct chain", () => {
    render(<WalletConnectButton />);
    expect(screen.queryByRole("button", { name: /switch to sepolia/i })).not.toBeInTheDocument();
  });
});

describe("WalletConnectButton when wrong network", () => {
  it("shows Switch to Sepolia when chainId is not Sepolia", async () => {
    const { useAccount, useSwitchChain } = await import("wagmi");
    vi.mocked(useAccount).mockReturnValue({
      address: "0x1234567890123456789012345678901234567890",
      isConnected: true,
      chainId: 1,
    } as never);
    vi.mocked(useSwitchChain).mockReturnValue({ switchChain: vi.fn(), isPending: false } as never);
    render(<WalletConnectButton />);
    expect(screen.getByRole("button", { name: /switch to sepolia/i })).toBeInTheDocument();
  });
});
