import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { getConnectionErrorMessage } from "../utils/errorMessages";
import { supportedChains } from "../config/wagmiConfig";

function getChainName(chainId: number): string {
  const c = supportedChains.find((ch) => ch.id === chainId);
  return c?.name ?? `Chain ${chainId}`;
}

export function WalletConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const [dismissedError, setDismissedError] = useState(false);
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false);

  const isWrongNetwork =
    isConnected && chainId !== undefined && !supportedChains.some((c) => c.id === chainId);
  const hasNoWallet = connectors.length === 0;

  useEffect(() => {
    if (connectError) setDismissedError(false);
  }, [connectError]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <button
            type="button"
            onClick={() => setNetworkMenuOpen((o) => !o)}
            disabled={isSwitchPending}
            className={`px-3 py-1.5 text-sm rounded border ${
              isWrongNetwork ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-700" : "border-gray-300 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            {isSwitchPending ? "Switching…" : (chainId != null ? getChainName(chainId) : "Select network")}
          </button>
          {networkMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setNetworkMenuOpen(false)} />
              <ul className="absolute right-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded shadow-lg z-20 min-w-[140px]">
                {supportedChains.map((ch) => (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => {
                        switchChain?.({ chainId: ch.id });
                        setNetworkMenuOpen(false);
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${chainId === ch.id ? "font-medium text-indigo-600" : "text-gray-700"}`}
                    >
                      {ch.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <span className="text-sm text-gray-600 font-mono" title={address}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (hasNoWallet) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded" role="status">
        No wallet found. Install{" "}
        <a
          href="https://metamask.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          MetaMask
        </a>{" "}
        or use a Web3-enabled browser.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {connectError && !dismissedError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
          <span>{getConnectionErrorMessage(connectError)}</span>
          <button
            type="button"
            onClick={() => setDismissedError(true)}
            className="text-red-700 hover:underline"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          disabled={isPending}
          onClick={() => connect({ connector })}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait text-sm font-medium"
        >
          {isPending ? "Connecting…" : `Connect ${connector.name}`}
        </button>
      ))}
    </div>
  );
}
