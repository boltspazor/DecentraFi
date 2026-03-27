import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { getCampaigns, getRecommendations, type CampaignMeta } from "../services/api";
import { PageShell } from "../components/PageShell";
import { cardInteractive } from "../styles/ui";

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
    <Link to={`/campaigns/${c.id}`} className="group block h-full animate-fade-in">
      <article
        className={`${cardInteractive} flex h-full flex-col group-hover:-translate-y-0.5`}
      >
        <h2 className="text-lg font-semibold leading-snug text-slate-900 transition group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-400">
          {c.title || "Untitled"}
        </h2>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {c.description || ""}
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          {c.category && (
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
              {c.category}
            </span>
          )}
          <span>Goal {goalEth} ETH</span>
          <span>Raised {raisedEth} ETH</span>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{creator}</span>
          {c.status && (
            <span className="font-medium text-indigo-600 dark:text-indigo-400">{c.status}</span>
          )}
          {c.txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
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
    <PageShell>
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/50 to-violet-50/60 px-6 py-10 shadow-soft dark:border-indigo-500/20 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-violet-950/30 dark:shadow-none sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Crowdfunding on-chain
          </p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Fund ideas that matter — transparently, on Ethereum.
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
            DecentraFI connects creators and backers with wallet-native flows. Create a campaign, contribute
            with ETH, and track everything on Sepolia or mainnet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/explore"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 dark:shadow-indigo-500/25"
            >
              Explore campaigns
            </Link>
            <Link
              to="/create"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Start a campaign
            </Link>
          </div>
        </div>
      </section>

      {address && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recommended for you</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Based on your contributions and similar campaigns.
          </p>
          {recommendationsLoading && (
            <p className="mt-6 text-slate-500 dark:text-slate-400">Loading recommendations…</p>
          )}
          {!recommendationsLoading && recommendedList.length === 0 && (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              No recommendations yet. Explore campaigns or contribute to get personalized picks.
            </p>
          )}
          {!recommendationsLoading && recommendedList.length > 0 && (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedList.map((c) => (
                <li key={c.id} className="min-w-0">
                  <CampaignCard c={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">All campaigns</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Discover projects raising on-chain.</p>
          </div>
          {!isLoading && isFetching && list.length > 0 && (
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Refreshing…</span>
          )}
        </div>
        {isLoading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-800/50"
              />
            ))}
          </div>
        )}
        {error && (
          <div
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            <p className="font-medium">{errorMessage}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/70"
            >
              Retry
            </button>
          </div>
        )}
        {!isLoading && !error && list.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No campaigns yet.{" "}
            <Link to="/create" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Create the first one
            </Link>
            .
          </p>
        )}
        {!error && list.length > 0 && (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <li key={c.id} className="min-w-0">
                <CampaignCard c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
