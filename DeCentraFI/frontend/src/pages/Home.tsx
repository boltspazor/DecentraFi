import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { getCampaigns, getRecommendations, type CampaignMeta } from "../services/api";

function CampaignCard({ c }: { c: CampaignMeta }) {
  const goalNum = Number(c.goal);
  const goalEth = Number.isFinite(goalNum) ? (goalNum / 1e18).toFixed(4) : "—";
  const raisedNum = c.totalRaised != null ? Number(c.totalRaised) : 0;
  const raisedEth = Number.isFinite(raisedNum) ? (raisedNum / 1e18).toFixed(4) : "0";
  const progress = goalNum > 0 ? Math.min(100, (raisedNum / goalNum) * 100) : 0;
  const creator = c.creator && c.creator.length >= 10
    ? `${c.creator.slice(0, 6)}…${c.creator.slice(-4)}`
    : "—";
  return (
    <Link to={`/campaigns/${c.id}`}>
      <article className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
        <h2 className="text-lg font-semibold text-gray-900">{c.title || "Untitled"}</h2>
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{c.description || ""}</p>
        <div className="mt-2 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          {c.category && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{c.category}</span>
          )}
          <span>Goal: {goalEth} ETH</span>
          <span>Raised: {raisedEth} ETH</span>
          <span>Creator: {creator}</span>
          {c.status && <span className="text-indigo-600">{c.status}</span>}
          {c.txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View tx
            </a>
          )}
        </div>
      </article>
    </Link>
  );
}

export function Home() {
  const { address } = useAccount();
  const { data: campaigns, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: getCampaigns,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: true,
  });
  const { data: recommended = [], isLoading: recommendationsLoading } = useQuery({
    queryKey: ["recommendations", address],
    queryFn: () => getRecommendations(address!, 12),
    enabled: !!address,
    retry: 1,
  });

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("campaigns-refresh", handler);
    return () => window.removeEventListener("campaigns-refresh", handler);
  }, [refetch]);

  const list = Array.isArray(campaigns) ? campaigns : [];
  const recommendedList = Array.isArray(recommended) ? recommended : [];
  const errorMessage = error instanceof Error ? error.message : "Failed to load campaigns";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">DecentraFI</h1>
      <p className="text-gray-600 mb-8">
        Decentralized crowdfunding on Sepolia. Connect your wallet and create or fund campaigns.
      </p>

      {address && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recommended Campaigns</h2>
          <p className="text-sm text-gray-500 mb-4">
            Based on your contributions and similar campaigns.
          </p>
          {recommendationsLoading && <p className="text-gray-500">Loading recommendations…</p>}
          {!recommendationsLoading && recommendedList.length === 0 && (
            <p className="text-gray-500">No recommendations yet. Explore campaigns or contribute to get personalized picks.</p>
          )}
          {!recommendationsLoading && recommendedList.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {recommendedList.map((c) => (
                <li key={c.id}>
                  <CampaignCard c={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Campaigns</h2>
        {isLoading && <p className="text-gray-500">Loading campaigns…</p>}
        {!isLoading && isFetching && list.length > 0 && (
          <p className="text-sm text-gray-500">Updating…</p>
        )}
        {error && (
          <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200" role="alert">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 px-3 py-1 text-sm bg-red-100 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}
        {!isLoading && !error && list.length === 0 && (
          <p className="text-gray-500">No campaigns yet. Create the first one!</p>
        )}
        {!error && list.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {list.map((c) => (
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
