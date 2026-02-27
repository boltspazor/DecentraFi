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
  const { data: creator } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "creator",
    chainId: sepolia.id,
  });

  const refetch = () => {
    refetchTotal();
  };

  return {
    goal: goal ?? 0n,
    deadline: deadline ?? 0n,
    totalContributed: totalContributed ?? 0n,
    closed: closed ?? false,
    fundsWithdrawn: fundsWithdrawn ?? false,
    creator: creator ?? "0x0",
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

  function withdrawFunds() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "withdrawFunds",
      chainId: sepolia.id,
    });
  }

  return {
    withdrawFunds,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}
