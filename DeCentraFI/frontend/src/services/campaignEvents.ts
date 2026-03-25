import { useEffect, useRef } from "react";
import { ethers } from "ethers";
import { campaignAbi } from "../abis/campaign";

type EventName = "ContributionReceived" | "FundsReleased" | "RefundClaimed" | "StreamStarted" | "StreamWithdrawn";

export interface CampaignEventHandlers {
  onContributionReceived?: (payload: {
    contributor: string;
    amountWei: bigint;
    txHash: string;
  }) => void;
  onFundsReleased?: (payload: { creator: string; amountWei: bigint; txHash: string }) => void;
  onStreamStarted?: (payload: {
    creator: string;
    totalAmountWei: bigint;
    durationSeconds: bigint;
    rateWeiPerSecond: bigint;
    startTime: bigint;
    endTime: bigint;
    txHash: string;
  }) => void;
  onStreamWithdrawn?: (payload: {
    creator: string;
    amountWei: bigint;
    totalWithdrawnWei: bigint;
    txHash: string;
  }) => void;
  onRefundClaimed?: (payload: {
    contributor: string;
    amountWei: bigint;
    txHash: string;
  }) => void;
}

function getWebSocketProvider() {
  const url = import.meta.env.VITE_WS_RPC_URL as string | undefined;
  if (!url) return null;
  try {
    return new ethers.WebSocketProvider(url);
  } catch {
    return null;
  }
}

export function useCampaignEvents(
  campaignAddress: `0x${string}` | null,
  handlers: CampaignEventHandlers
) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!campaignAddress) return;
    const provider = getWebSocketProvider();
    if (!provider) return;

    const contract = new ethers.Contract(campaignAddress, campaignAbi as any, provider);

    const contributionListener = (contributor: string, amount: bigint, event: ethers.Log) => {
      if (!mountedRef.current) return;
      handlers.onContributionReceived?.({
        contributor,
        amountWei: amount,
        txHash: event.transactionHash,
      });
    };

    const fundsReleasedListener = (creator: string, amount: bigint, event: ethers.Log) => {
      if (!mountedRef.current) return;
      handlers.onFundsReleased?.({
        creator,
        amountWei: amount,
        txHash: event.transactionHash,
      });
    };

    const streamStartedListener = (
      creator: string,
      totalAmount: bigint,
      durationSeconds: bigint,
      ratePerSecond: bigint,
      startTime: bigint,
      endTime: bigint,
      event: ethers.Log
    ) => {
      if (!mountedRef.current) return;
      handlers.onStreamStarted?.({
        creator,
        totalAmountWei: totalAmount,
        durationSeconds,
        rateWeiPerSecond: ratePerSecond,
        startTime,
        endTime,
        txHash: event.transactionHash,
      });
    };

    const streamWithdrawnListener = (
      creator: string,
      amount: bigint,
      totalWithdrawn: bigint,
      event: ethers.Log
    ) => {
      if (!mountedRef.current) return;
      handlers.onStreamWithdrawn?.({
        creator,
        amountWei: amount,
        totalWithdrawnWei: totalWithdrawn,
        txHash: event.transactionHash,
      });
    };

    const refundClaimedListener = (contributor: string, amount: bigint, event: ethers.Log) => {
      if (!mountedRef.current) return;
      handlers.onRefundClaimed?.({
        contributor,
        amountWei: amount,
        txHash: event.transactionHash,
      });
    };

    contract.on("ContributionReceived" as EventName, contributionListener);
    contract.on("FundsReleased" as EventName, fundsReleasedListener);
    contract.on("StreamStarted" as EventName, streamStartedListener);
    contract.on("StreamWithdrawn" as EventName, streamWithdrawnListener);
    contract.on("RefundClaimed" as EventName, refundClaimedListener);

    return () => {
      contract.off("ContributionReceived" as EventName, contributionListener);
      contract.off("FundsReleased" as EventName, fundsReleasedListener);
      contract.off("StreamStarted" as EventName, streamStartedListener);
      contract.off("StreamWithdrawn" as EventName, streamWithdrawnListener);
      contract.off("RefundClaimed" as EventName, refundClaimedListener);
      provider.destroy?.();
    };
  }, [
    campaignAddress,
    handlers.onContributionReceived,
    handlers.onFundsReleased,
    handlers.onStreamStarted,
    handlers.onStreamWithdrawn,
    handlers.onRefundClaimed,
  ]);
}

