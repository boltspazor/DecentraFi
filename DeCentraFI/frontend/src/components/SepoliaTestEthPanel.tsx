import { useAccount, useBalance, useChainId } from "wagmi";
import { formatEther } from "viem";
import { isSepoliaChain } from "../utils/nativeCurrency";

const FAUCETS = [
  { name: "Sepolia PoW faucet", href: "https://sepolia-faucet.pk910.de/" },
  { name: "Alchemy Sepolia faucet", href: "https://sepoliafaucet.com/" },
  { name: "Infura faucet", href: "https://www.infura.io/faucet/sepolia" },
  { name: "Ethereum.org — testnets", href: "https://ethereum.org/en/developers/docs/networks/#sepolia" },
] as const;

/**
 * Explains that crowdfunding uses native Sepolia ETH (free test ether) and links to faucets.
 */
export function SepoliaTestEthPanel() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { data: bal, isLoading } = useBalance({
    address,
    chainId,
    query: { enabled: isConnected && !!address && isSepoliaChain(chainId) },
  });

  if (!isSepoliaChain(chainId)) return null;

  return (
    <div
      className="rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/90 to-indigo-50/50 p-4 text-sm dark:border-cyan-900/50 dark:from-cyan-950/40 dark:to-indigo-950/30"
      role="region"
      aria-label="Sepolia test ETH"
    >
      <p className="font-semibold text-slate-900 dark:text-cyan-100">Sepolia test transactions</p>
      <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">
        This app sends <strong>native Sepolia ETH</strong> in each contribution or campaign deploy — the same
        &quot;fake&quot; currency every Ethereum testnet uses. It has no mainnet value. Get free Sepolia ETH from a
        faucet, then confirm trades in your wallet like on mainnet.
      </p>
      {isConnected && address && (
        <p className="mt-3 font-mono text-xs text-slate-600 dark:text-slate-400">
          Your balance:{" "}
          {isLoading ? (
            "…"
          ) : bal != null ? (
            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
              {formatEther(bal.value)} {bal.symbol}
            </span>
          ) : (
            "—"
          )}
        </p>
      )}
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
        Faucets (try another if one is empty)
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {FAUCETS.map(({ name, href }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg border border-cyan-300/80 bg-white/80 px-2.5 py-1 text-xs font-medium text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-800 dark:bg-slate-900/60 dark:text-cyan-200 dark:hover:bg-cyan-950/80"
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
