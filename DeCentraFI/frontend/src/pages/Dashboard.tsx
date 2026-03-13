import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getUserContributions, type UserContributionSummary } from "../services/api";
import { useCampaign } from "../services/campaignContract";

function formatEth(wei: string): string {
  const num = Number(wei);
  if (!Number.isFinite(num)) return "0.0000";
  return (num / 1e18).toFixed(4);
}

function DashboardRow({ item }: { item: UserContributionSummary }) {
  const addr = item.campaignAddress as `0x${string}`;
  const {
    goal,
    totalRaised,
    totalContributed,
    refundEnabled,
    myContribution,
  } = useCampaign(addr);

  const raisedForProgress = totalRaised > 0n ? totalRaised : totalContributed;
  const progressPercent = goal > 0n ? Number((raisedForProgress * 100n) / goal) : 0;
  const refundEligible = refundEnabled && myContribution > 0n;

  return (
    <li className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{item.title || "Untitled"}</h3>
          <p className="text-xs text-gray-500">
            Contributed: {formatEth(item.amountWei)} ETH • Status:{" "}
            <span className="font-medium">{item.status}</span>
          </p>
        </div>
        <Link
          to={`/campaigns/${item.campaignId}`}
          className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          View
        </Link>
      </div>
      <div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Progress: {progressPercent}% • Your share: {formatEth(myContribution.toString())} ETH
        </p>
      </div>
      <div className="flex justify-between items-center text-xs text-gray-600">
        {refundEligible ? (
          <span className="text-amber-700 font-medium">Refund eligible</span>
        ) : (
          <span className="text-gray-400">Refund not available</span>
        )}
      </div>
    </li>
  );
}

export function Dashboard() {
  const { address, isConnected } = useAccount();

  const { data, isLoading, error, refetch, isFetching } = useQuery<UserContributionSummary[]>({
    queryKey: ["user-contributions", address],
    enabled: !!address,
    queryFn: () => getUserContributions(address!),
    retry: 2,
  });

  if (!isConnected || !address) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Dashboard</h1>
        <p className="text-gray-600">
          Connect your wallet to view campaigns you have funded.
        </p>
      </div>
    );
  }

  const list = Array.isArray(data) ? data : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Dashboard</h1>
      <p className="text-gray-600 mb-4">
        Overview of campaigns you have contributed to, including progress and refund eligibility.
      </p>

      {isLoading && <p className="text-gray-500">Loading your contributions…</p>}
      {!isLoading && error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
          <p>Failed to load your contributions.</p>
          <button
            type="button"
            className="mt-2 px-3 py-1 rounded bg-red-100 hover:bg-red-200"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      )}
      {!isLoading && !error && list.length === 0 && (
        <p className="text-gray-500">You have not contributed to any campaigns yet.</p>
      )}
      {!error && list.length > 0 && (
        <>
          {isFetching && (
            <p className="text-xs text-gray-400 mb-2">Updating latest contributions…</p>
          )}
          <ul className="space-y-3">
            {list.map((item) => (
              <DashboardRow key={`${item.campaignId}-${item.createdAt}`} item={item} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

