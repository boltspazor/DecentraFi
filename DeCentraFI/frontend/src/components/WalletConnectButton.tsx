import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getConnectionErrorMessage } from "../utils/errorMessages";

export function WalletConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const [dismissedError, setDismissedError] = useState(false);

  const isWrongNetwork = isConnected && chainId !== undefined && chainId !== sepolia.id;
  const hasNoWallet = connectors.length === 0;

  useEffect(() => {
    if (connectError) setDismissedError(false);
  }, [connectError]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {isWrongNetwork && switchChain && (
          <button
            type="button"
            onClick={() => switchChain({ chainId: sepolia.id })}
            disabled={isSwitchPending}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {isSwitchPending ? "Switching…" : "Switch to Sepolia"}
          </button>
        )}
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
