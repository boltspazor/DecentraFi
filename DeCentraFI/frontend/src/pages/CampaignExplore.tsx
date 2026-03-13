import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type CampaignMeta, type CampaignSearchResult, searchCampaigns } from "../services/api";

function toWei(valueEth: string | undefined): string | undefined {
  if (!valueEth) return undefined;
  const trimmed = valueEth.trim();
  if (!trimmed) return undefined;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  try {
    const wei = BigInt(Math.floor(n * 1e18));
    return wei > 0n ? wei.toString() : undefined;
  } catch {
    return undefined;
  }
}

function formatEth(wei: string | undefined): string {
  if (!wei) return "0.0000";
  const num = Number(wei);
  if (!Number.isFinite(num)) return "0.0000";
  return (num / 1e18).toFixed(4);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function CampaignCard({ c }: { c: CampaignMeta }) {
  const goalNum = Number(c.goal);
  const goalEth = Number.isFinite(goalNum) ? (goalNum / 1e18).toFixed(4) : "—";
  const raisedNum = c.totalRaised != null ? Number(c.totalRaised) : 0;
  const raisedEth = Number.isFinite(raisedNum) ? (raisedNum / 1e18).toFixed(4) : "0.0000";
  const progress = goalNum > 0 ? Math.min(100, (raisedNum / goalNum) * 100) : 0;
  const creator =
    c.creator && c.creator.length >= 10
      ? `${c.creator.slice(0, 6)}…${c.creator.slice(-4)}`
      : c.creator || "—";

  return (
    <Link to={`/campaigns/${c.id}`}>
      <article className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{c.title || "Untitled"}</h2>
        <p className="text-xs text-gray-500 mb-2">
          Creator: <span className="font-mono">{creator}</span>
        </p>
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{c.description || ""}</p>
        <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>Goal: {goalEth} ETH</span>
          <span>Raised: {raisedEth} ETH</span>
          {c.status && <span className="text-indigo-600">{c.status}</span>}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Deadline: {formatDate(c.deadline)}
        </p>
      </article>
    </Link>
  );
}

export function CampaignExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [goalMin, setGoalMin] = useState(() => searchParams.get("goalMin") ?? "");
  const [goalMax, setGoalMax] = useState(() => searchParams.get("goalMax") ?? "");
  const [deadlineBefore, setDeadlineBefore] = useState(
    () => searchParams.get("deadline")?.slice(0, 16) ?? ""
  );

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (keyword) next.set("q", keyword);
    else next.delete("q");
    if (status) next.set("status", status);
    else next.delete("status");
    if (goalMin) next.set("goalMin", goalMin);
    else next.delete("goalMin");
    if (goalMax) next.set("goalMax", goalMax);
    else next.delete("goalMax");
    if (deadlineBefore) next.set("deadline", deadlineBefore);
    else next.delete("deadline");
    if (!next.get("page")) next.set("page", "1");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queryKey = useMemo(
    () => [
      "campaigns-search",
      {
        q: keyword || undefined,
        status: status || undefined,
        goalMin,
        goalMax,
        deadlineBefore,
        page,
      },
    ],
    [keyword, status, goalMin, goalMax, deadlineBefore, page]
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery<CampaignSearchResult>({
    queryKey,
    queryFn: () =>
      searchCampaigns({
        q: keyword || undefined,
        status: status ? (status === "Active" || status === "Successful" || status === "Failed" ? status : undefined) : undefined,
        goalMinWei: toWei(goalMin),
        goalMaxWei: toWei(goalMax),
        deadlineBefore: deadlineBefore || undefined,
        page,
        pageSize: 12,
      }),
    keepPreviousData: true,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const applyFilters = (nextPage = 1) => {
    const next = new URLSearchParams();
    if (keyword) next.set("q", keyword);
    if (status) next.set("status", status);
    if (goalMin) next.set("goalMin", goalMin);
    if (goalMax) next.set("goalMax", goalMax);
    if (deadlineBefore) next.set("deadline", deadlineBefore);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || (data && nextPage > totalPages)) return;
    applyFilters(nextPage);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Explore Campaigns</h1>
      <p className="text-gray-600 mb-6">
        Search and filter campaigns by keyword, status, goal range, and deadline.
      </p>

      <form
        className="mb-6 grid gap-4 md:grid-cols-4 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(1);
          refetch();
        }}
      >
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="keyword">
            Keyword
          </label>
          <input
            id="keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search by title, description, or creator"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Any</option>
            <option value="Active">Active</option>
            <option value="Successful">Successful</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deadline">
            Deadline before
          </label>
          <input
            id="deadline"
            type="datetime-local"
            value={deadlineBefore}
            onChange={(e) => setDeadlineBefore(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="goalMin">
            Min goal (ETH)
          </label>
          <input
            id="goalMin"
            type="number"
            min="0"
            step="0.01"
            value={goalMin}
            onChange={(e) => setGoalMin(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="goalMax">
            Max goal (ETH)
          </label>
          <input
            id="goalMax"
            type="number"
            min="0"
            step="0.01"
            value={goalMax}
            onChange={(e) => setGoalMax(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Search
          </button>
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
            onClick={() => {
              setKeyword("");
              setStatus("");
              setGoalMin("");
              setGoalMax("");
              setDeadlineBefore("");
              const next = new URLSearchParams();
              next.set("page", "1");
              setSearchParams(next);
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {isLoading && <p className="text-gray-500">Loading campaigns…</p>}
      {!isLoading && isFetching && <p className="text-sm text-gray-500 mb-2">Updating…</p>}
      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 mb-4" role="alert">
          <p>{(error as Error).message || "Failed to load campaigns"}</p>
          <button
            type="button"
            className="mt-2 px-3 py-1 text-sm bg-red-100 rounded hover:bg-red-200"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {data && data.items.length === 0 && !isLoading && !error && (
        <p className="text-gray-500">No campaigns match your filters.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {data.items.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {data.page} of {totalPages} • {data.total} campaigns
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

