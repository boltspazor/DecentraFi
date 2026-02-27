import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCampaigns, type CampaignMeta } from "../services/api";

function CampaignCard({ c }: { c: CampaignMeta }) {
  const goalEth = (Number(c.goal) / 1e18).toFixed(4);
  return (
    <article className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-lg font-semibold text-gray-900">{c.title}</h2>
      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{c.description}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        <span>Goal: {goalEth} ETH</span>
        <span>Creator: {c.creator.slice(0, 6)}…{c.creator.slice(-4)}</span>
        {c.txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            View tx
          </a>
        )}
      </div>
    </article>
  );
}

export function Home() {
  const { data: campaigns, isLoading, error, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: getCampaigns,
  });

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("campaigns-refresh", handler);
    return () => window.removeEventListener("campaigns-refresh", handler);
  }, [refetch]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">DecentraFI</h1>
      <p className="text-gray-600 mb-8">
        Decentralized crowdfunding on Sepolia. Connect your wallet and create or fund campaigns.
      </p>
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Campaigns</h2>
        {isLoading && <p className="text-gray-500">Loading campaigns…</p>}
        {error && (
          <p className="text-red-600 bg-red-50 p-3 rounded">
            Failed to load campaigns: {(error as Error).message}
          </p>
        )}
        {campaigns && campaigns.length === 0 && (
          <p className="text-gray-500">No campaigns yet. Create the first one!</p>
        )}
        {campaigns && campaigns.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <CampaignCard c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
