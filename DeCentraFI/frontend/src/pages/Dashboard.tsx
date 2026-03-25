import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getUserContributions,
  getUserNfts,
  type UserContributionSummary,
  type UserNft,
} from "../services/api";
import { useCampaign } from "../services/campaignContract";
import { useCampaignEvents } from "../services/campaignEvents";

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
    refetch,
  } = useCampaign(addr);

  useCampaignEvents(addr, {
    onContributionReceived: () => {
      refetch();
    },
    onFundsReleased: () => {
      refetch();
    },
    onStreamWithdrawn: () => {
      refetch();
    },
    onRefundClaimed: () => {
      refetch();
    },
  });

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

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<UserContributionSummary[]>({
    queryKey: ["user-contributions", address],
    enabled: !!address,
    queryFn: () => getUserContributions(address!),
    retry: 2,
  });

  const {
    data: nftData,
    isLoading: isLoadingNfts,
    error: nftError,
  } = useQuery<UserNft[]>({
    queryKey: ["user-nfts", address],
    enabled: !!address,
    queryFn: () => getUserNfts(address!),
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
  const nftList = Array.isArray(nftData) ? nftData : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Dashboard</h1>
      <p className="text-gray-600 mb-4">
        Overview of campaigns you have contributed to and your Supporter Badge NFTs.
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

      <div className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Supporter Badge NFTs</h2>
        {isLoadingNfts && <p className="text-gray-500">Loading your supporter NFTs…</p>}
        {!isLoadingNfts && nftError && (
          <p className="text-sm text-red-600">Failed to load your supporter NFTs.</p>
        )}
        {!isLoadingNfts && !nftError && nftList.length === 0 && (
          <p className="text-gray-500 text-sm">
            You do not have any supporter badge NFTs yet. Contribute to campaigns to earn Bronze,
            Silver, or Gold badges.
          </p>
        )}
        {!isLoadingNfts && !nftError && nftList.length > 0 && (
          <ul className="mt-2 space-y-2">
            {nftList.map((nft) => {
              const levelLabel =
                nft.nftLevel.toLowerCase() === "gold"
                  ? "Gold"
                  : nft.nftLevel.toLowerCase() === "silver"
                  ? "Silver"
                  : nft.nftLevel.toLowerCase() === "bronze"
                  ? "Bronze"
                  : nft.nftLevel;
              const ipfsUrl = nft.ipfsHash
                ? `https://ipfs.io/ipfs/${nft.ipfsHash}`
                : undefined;
              return (
                <li
                  key={`${nft.tokenId}-${nft.campaignId}-${nft.createdAt}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {levelLabel} Supporter Badge • Token #{nft.tokenId}
                    </p>
                    <p className="text-xs text-gray-500">
                      Campaign ID:{" "}
                      <Link
                        to={`/campaigns/${nft.campaignId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {nft.campaignId}
                      </Link>
                    </p>
                  </div>
                  {ipfsUrl && (
                    <a
                      href={ipfsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      View NFT
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

