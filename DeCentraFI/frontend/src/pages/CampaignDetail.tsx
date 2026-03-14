import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  useCampaign,
  useContribute,
  useWithdraw,
  useFinalize,
  useRefund,
} from "../services/campaignContract";
import * as api from "../services/api";
import { getTransactionErrorMessage } from "../utils/errorMessages";

const SEPOLIA_ETHERSCAN_TX = "https://sepolia.etherscan.io/tx/";

function formatCountdown(deadlineSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, deadlineSeconds - now);
  if (remaining <= 0) return "Ended";
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const [campaignMeta, setCampaignMeta] = useState<api.GetCampaignResponse | null>(null);
  const [contributions, setContributions] = useState<api.ContributionMeta[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [errorMeta, setErrorMeta] = useState<string | null>(null);
  const [contributeAmountEth, setContributeAmountEth] = useState("");
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [contributeSuccessTx, setContributeSuccessTx] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const processedTxRef = useRef<string | null>(null);

  const campaignAddress = campaignMeta?.campaignAddress
    ? (campaignMeta.campaignAddress as `0x${string}`)
    : null;

  const {
    goal,
    deadline,
    totalContributed,
    totalRaised,
    closed,
    fundsWithdrawn,
    fundsReleased,
    refundEnabled,
    finalized,
    creator,
    myContribution,
    refetch: refetchChain,
  } = useCampaign(campaignAddress);

  const {
    contribute: contributeOnChain,
    isPending: isContributePending,
    isSuccess: isContributeSuccess,
    hash: contributeTxHash,
    error: contributeTxError,
    reset: resetContribute,
    contributorAddress,
  } = useContribute(campaignAddress);

  const {
    releaseFunds,
    isPending: isWithdrawPending,
    isSuccess: isWithdrawSuccess,
    error: withdrawError,
    reset: resetWithdraw,
  } = useWithdraw(campaignAddress);

  const {
    finalizeAfterDeadline,
    isPending: isFinalizePending,
    isSuccess: isFinalizeSuccess,
    reset: resetFinalize,
  } = useFinalize(campaignAddress);

  const {
    claimRefund,
    isPending: isRefundPending,
    isSuccess: isRefundSuccess,
    error: refundError,
    reset: resetRefund,
  } = useRefund(campaignAddress);

  const isWrongNetwork = isConnected && chainId !== undefined && chainId !== sepolia.id;
  const isCreator = address && creator && address.toLowerCase() === creator.toLowerCase();
  const deadlineNum = Number(deadline);
  const isExpired = deadlineNum > 0 && Math.floor(Date.now() / 1000) >= deadlineNum;
  const goalReached = goal > 0n && totalRaised >= goal;
  const raisedForProgress = totalRaised > 0n ? totalRaised : totalContributed;
  const progressPercent = goal > 0n ? Number((raisedForProgress * 100n) / goal) : 0;
  const canReleaseFunds =
    isCreator && closed && !fundsWithdrawn && !fundsReleased && isExpired;
  const canClaimRefund =
    isConnected &&
    address &&
    refundEnabled &&
    myContribution > 0n;
  const canFinalize = isExpired && !finalized && !closed && !refundEnabled;

  useEffect(() => {
    if (!id) return;
    api
      .getCampaign(id)
      .then((c) => {
        setCampaignMeta(c);
        if (Array.isArray(c.contributors) && c.contributors.length >= 0) {
          setContributions(c.contributors);
        }
        if (Array.isArray(c.contributors)) return null;
        return api.getContributionsByCampaign(c.id);
      })
      .then((list) => {
        if (Array.isArray(list)) setContributions(list);
      })
      .catch((e) => setErrorMeta(e instanceof Error ? e.message : "Failed to load campaign"))
      .finally(() => setLoadingMeta(false));
  }, [id]);

  useEffect(() => {
    if (deadlineNum <= 0) return;
    const tick = () => setCountdown(formatCountdown(deadlineNum));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineNum]);

  useEffect(() => {
    if (!isContributeSuccess || !contributeTxHash || !campaignMeta || !contributorAddress) return;
    if (processedTxRef.current === contributeTxHash) return;
    processedTxRef.current = contributeTxHash;
    const txHash = contributeTxHash;
    const amountWei = contributeAmountEth
      ? String(BigInt(Math.floor(parseFloat(contributeAmountEth) * 1e18)))
      : "0";
    resetContribute();
    api
      .postContribution({
        campaignId: campaignMeta.id,
        contributorAddress,
        amountWei,
        txHash,
      })
      .then(() => {
        setContributeSuccessTx(txHash);
        setContributeAmountEth("");
        setContributeError(null);
        refetchChain();
        return api.getCampaign(String(campaignMeta.id));
      })
      .then(setCampaignMeta)
      .then(() => api.getContributionsByCampaign(campaignMeta.id))
      .then(setContributions)
      .catch((e) => {
        processedTxRef.current = null;
        setContributeError(e instanceof Error ? e.message : "Failed to record contribution");
      });
  }, [isContributeSuccess, contributeTxHash, campaignMeta, contributorAddress, contributeAmountEth, refetchChain, resetContribute]);

  useEffect(() => {
    if (isWithdrawSuccess) {
      refetchChain();
      if (campaignMeta) api.getCampaign(String(campaignMeta.id)).then(setCampaignMeta);
      resetWithdraw();
    }
  }, [isWithdrawSuccess, refetchChain, campaignMeta, resetWithdraw]);

  useEffect(() => {
    if (isFinalizeSuccess) {
      refetchChain();
      resetFinalize();
    }
  }, [isFinalizeSuccess, refetchChain, resetFinalize]);

  useEffect(() => {
    if (isRefundSuccess) {
      refetchChain();
      if (campaignMeta) api.getCampaign(String(campaignMeta.id)).then(setCampaignMeta);
      resetRefund();
    }
  }, [isRefundSuccess, refetchChain, campaignMeta, resetRefund]);

  const handleContribute = (e: React.FormEvent) => {
    e.preventDefault();
    setContributeError(null);
    if (!isConnected || !address) {
      setContributeError("Connect your wallet first");
      return;
    }
    if (isWrongNetwork) {
      setContributeError("Switch to Sepolia network");
      return;
    }
    const num = parseFloat(contributeAmountEth);
    if (Number.isNaN(num) || num <= 0) {
      setContributeError("Enter a valid amount greater than zero");
      return;
    }
    if (closed || isExpired) {
      setContributeError("This campaign is no longer accepting contributions");
      return;
    }
    const valueWei = BigInt(Math.floor(num * 1e18));
    if (valueWei <= 0n) {
      setContributeError("Amount must be greater than zero");
      return;
    }
    try {
      contributeOnChain(valueWei);
    } catch (err) {
      setContributeError(getTransactionErrorMessage(err));
    }
  };

  const handleReleaseFunds = () => {
    if (!canReleaseFunds) return;
    setContributeError(null);
    try {
      releaseFunds();
    } catch (err) {
      setContributeError(getTransactionErrorMessage(err));
    }
  };

  const handleFinalize = () => {
    if (!canFinalize) return;
    setContributeError(null);
    try {
      finalizeAfterDeadline();
    } catch (err) {
      setContributeError(getTransactionErrorMessage(err));
    }
  };

  const handleClaimRefund = () => {
    if (!canClaimRefund) return;
    setContributeError(null);
    try {
      claimRefund();
    } catch (err) {
      setContributeError(getTransactionErrorMessage(err));
    }
  };

  if (loadingMeta) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading campaign…</p>
      </div>
    );
  }

  if (errorMeta || !campaignMeta) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-600">{errorMeta ?? "Campaign not found"}</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600 hover:underline">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const goalEth = (Number(campaignMeta.goal) / 1e18).toFixed(4);
  const raisedEth = (Number(raisedForProgress) / 1e18).toFixed(4);
  const contributorCount = contributions.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="text-indigo-600 hover:underline mb-6 inline-block">
        ← Back to campaigns
      </Link>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">{campaignMeta.title}</h1>
        {campaignMeta.isVerified && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium bg-green-100 text-green-800">
            ✔ Verified Campaign
          </span>
        )}
        {(campaignMeta.reportCount ?? 0) > 0 && !campaignMeta.isVerified && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium bg-amber-100 text-amber-800">
            ⚠ Reported Campaign
          </span>
        )}
      </div>
      <p className="text-gray-600 whitespace-pre-wrap mb-6">{campaignMeta.description}</p>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-sm mb-2">
          <span>Goal: {goalEth} ETH</span>
          <span>Raised: {raisedEth} ETH (on-chain)</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{progressPercent}% funded</p>
        <p className="text-sm text-gray-600 mt-2">
          Deadline: {new Date(deadlineNum * 1000).toLocaleString()}
          {countdown && countdown !== "Ended" && (
            <span className="ml-2 font-medium text-indigo-600">• {countdown}</span>
          )}
        </p>
        <p className="text-sm text-gray-600">Contributors: {contributorCount}</p>
        {campaignMeta.status && (
          <p className="text-sm font-medium mt-1">
            Status: <span className="text-indigo-600">{campaignMeta.status}</span>
          </p>
        )}
        {typeof campaignMeta.creatorTrustScore === "number" && (
          <p className="text-sm text-gray-700 mt-2">
            <span className="text-amber-500">⭐</span> Trust Score:{" "}
            <span className="font-semibold">{campaignMeta.creatorTrustScore}/10</span>
          </p>
        )}
      </div>

      {isConnected && address && !campaignMeta.isVerified && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Report Campaign</h2>
          <p className="text-sm text-gray-600 mb-2">
            Seen something wrong? Submit a report for moderators to review.
          </p>
          {reportSuccess ? (
            <p className="text-sm text-green-600">Report submitted. Thank you.</p>
          ) : (
            <>
              <textarea
                placeholder="Reason (optional)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
                rows={2}
              />
              <button
                type="button"
                disabled={reportSubmitting}
                onClick={async () => {
                  setReportError(null);
                  setReportSubmitting(true);
                  try {
                    await api.reportCampaign({
                      campaignId: campaignMeta.id,
                      reporterWallet: address,
                      reason: reportReason.trim() || undefined,
                    });
                    setReportSuccess(true);
                    const updated = await api.getCampaign(String(campaignMeta.id));
                    setCampaignMeta(updated);
                  } catch (e) {
                    setReportError(e instanceof Error ? e.message : "Failed to submit report");
                  } finally {
                    setReportSubmitting(false);
                  }
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 text-sm"
              >
                {reportSubmitting ? "Submitting…" : "Report Campaign"}
              </button>
              {reportError && (
                <p className="mt-2 text-sm text-red-600">{reportError}</p>
              )}
            </>
          )}
        </div>
      )}

      {isWrongNetwork && switchChain && (
        <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800">
          <p>Switch to Sepolia to contribute or withdraw.</p>
          <button
            type="button"
            onClick={() => switchChain({ chainId: sepolia.id })}
            className="mt-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Switch to Sepolia
          </button>
        </div>
      )}

      {isExpired && (
        <div className="mb-4 p-3 rounded bg-gray-100 text-gray-800">
          {goalReached ? (
            <p className="font-medium">Goal Reached – Creator Can Withdraw</p>
          ) : (
            <p className="font-medium">Goal Not Met – Claim Refund Available</p>
          )}
        </div>
      )}

      {canReleaseFunds && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleReleaseFunds}
            disabled={isWithdrawPending}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isWithdrawPending ? "Withdrawing…" : "Withdraw funds"}
          </button>
          {(withdrawError || contributeError) && (
            <p className="mt-2 text-sm text-red-600">
              {getTransactionErrorMessage(withdrawError ?? contributeError)}
            </p>
          )}
        </div>
      )}

      {canFinalize && isConnected && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isFinalizePending}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {isFinalizePending ? "Finalizing…" : "Enable refunds (goal not met)"}
          </button>
        </div>
      )}

      {canClaimRefund && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleClaimRefund}
            disabled={isRefundPending}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {isRefundPending ? "Claiming…" : "Claim refund"}
          </button>
          <p className="text-xs text-gray-600 mt-1">
            Your contribution: {(Number(myContribution) / 1e18).toFixed(4)} ETH
          </p>
          {refundError && (
            <p className="mt-2 text-sm text-red-600">{getTransactionErrorMessage(refundError)}</p>
          )}
        </div>
      )}

      {!closed && !isExpired && (
        <div className="mb-8 p-4 border border-gray-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Contribute</h2>
          {!isConnected && (
            <p className="text-amber-700 mb-3">Connect your wallet to contribute.</p>
          )}
          {(contributeTxError || contributeError) && (
            <p className="mb-3 text-sm text-red-600">
              {getTransactionErrorMessage(contributeTxError ?? contributeError)}
            </p>
          )}
          {contributeSuccessTx && (
            <p className="mb-3 text-sm text-green-600">
              Contribution confirmed!{" "}
              <a
                href={`${SEPOLIA_ETHERSCAN_TX}${contributeSuccessTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View transaction
              </a>
            </p>
          )}
          <form onSubmit={handleContribute} className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (ETH)
              </label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={contributeAmountEth}
                onChange={(e) => setContributeAmountEth(e.target.value)}
                placeholder="0.1"
                className="w-32 px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              disabled={isContributePending || !isConnected || isWrongNetwork}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isContributePending ? "Confirm in wallet…" : "Contribute"}
            </button>
          </form>
        </div>
      )}

      {(closed || isExpired) && !canReleaseFunds && !canClaimRefund && (
        <p className="text-gray-500 mb-6">
          {goalReached
            ? "This campaign has reached its goal."
            : "This campaign has ended."}
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Contributions ({contributions.length})</h2>
        {contributions.length === 0 ? (
          <p className="text-gray-500">No contributions yet.</p>
        ) : (
          <ul className="space-y-2">
            {contributions.map((c) => (
              <li key={c.id} className="text-sm flex flex-wrap gap-2 items-center">
                <span className="font-mono">
                  {c.contributorAddress.slice(0, 6)}…{c.contributorAddress.slice(-4)}
                </span>
                <span>{(Number(c.amountWei) / 1e18).toFixed(4)} ETH</span>
                {c.txHash && (
                  <a
                    href={`${SEPOLIA_ETHERSCAN_TX}${c.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    View tx
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
