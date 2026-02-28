import { getContract } from "viem";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { campaignAbi } from "../abis/campaign";

function useCampaignContract(campaignAddress: `0x${string}` | null) {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });

  const contract =
    campaignAddress && publicClient
      ? getContract({
          address: campaignAddress,
          abi: campaignAbi,
          client: { public: publicClient, wallet: walletClient ?? undefined },
        })
      : null;

  return contract;
}

export function useCampaign(campaignAddress: `0x${string}` | null) {
  const { address } = useAccount();
  const { data: goal } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "goal",
    chainId: sepolia.id,
  });
  const { data: deadline } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "deadline",
    chainId: sepolia.id,
  });
  const { data: totalContributed, refetch: refetchTotal } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "totalContributed",
    chainId: sepolia.id,
  });
  const { data: totalRaised } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "totalRaised",
    chainId: sepolia.id,
  });
  const { data: closed } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "closed",
    chainId: sepolia.id,
  });
  const { data: fundsWithdrawn } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "fundsWithdrawn",
    chainId: sepolia.id,
  });
  const { data: fundsReleased } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "fundsReleased",
    chainId: sepolia.id,
  });
  const { data: refundEnabled } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "refundEnabled",
    chainId: sepolia.id,
  });
  const { data: finalized } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "finalized",
    chainId: sepolia.id,
  });
  const { data: creator } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "creator",
    chainId: sepolia.id,
  });
  const { data: myContribution, refetch: refetchMyContribution } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "contributions",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
  });

  const refetch = () => {
    refetchTotal();
    refetchMyContribution();
  };

  return {
    goal: goal ?? 0n,
    deadline: deadline ?? 0n,
    totalContributed: totalContributed ?? 0n,
    totalRaised: totalRaised ?? totalContributed ?? 0n,
    closed: closed ?? false,
    fundsWithdrawn: fundsWithdrawn ?? false,
    fundsReleased: fundsReleased ?? false,
    refundEnabled: refundEnabled ?? false,
    finalized: finalized ?? false,
    creator: creator ?? "0x0",
    myContribution: myContribution ?? 0n,
    refetch,
    contract: useCampaignContract(campaignAddress),
  };
}

export function useContribute(campaignAddress: `0x${string}` | null) {
  const { address } = useAccount();
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function contribute(valueWei: bigint) {
    if (!campaignAddress) throw new Error("Campaign address required");
    if (valueWei <= 0n) throw new Error("Amount must be greater than zero");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "contribute",
      value: valueWei,
      chainId: sepolia.id,
    });
  }

  return {
    contribute,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    contributorAddress: address ?? undefined,
  };
}

export function useWithdraw(campaignAddress: `0x${string}` | null) {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function releaseFunds() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "releaseFunds",
      chainId: sepolia.id,
    });
  }

  return {
    releaseFunds,
    withdrawFunds: releaseFunds,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useFinalize(campaignAddress: `0x${string}` | null) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function finalizeAfterDeadline() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "finalizeAfterDeadline",
      chainId: sepolia.id,
    });
  }

  return {
    finalizeAfterDeadline,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useRefund(campaignAddress: `0x${string}` | null) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function claimRefund() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "claimRefund",
      chainId: sepolia.id,
    });
  }

  return {
    claimRefund,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}
