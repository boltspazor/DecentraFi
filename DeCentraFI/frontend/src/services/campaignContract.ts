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

const DEFAULT_CHAIN_ID = sepolia.id;

function useCampaignContract(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

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

export function useCampaign(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const { address } = useAccount();
  const { data: goal } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "goal",
    chainId,
  });
  const { data: deadline } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "deadline",
    chainId,
  });
  const { data: totalContributed, refetch: refetchTotal } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "totalContributed",
    chainId,
  });
  const { data: totalRaised } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "totalRaised",
    chainId,
  });
  const { data: closed } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "closed",
    chainId,
  });
  const { data: fundsWithdrawn } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "fundsWithdrawn",
    chainId,
  });
  const { data: fundsReleased } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "fundsReleased",
    chainId,
  });
  const { data: refundEnabled } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "refundEnabled",
    chainId,
  });
  const { data: finalized } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "finalized",
    chainId,
  });
  const { data: creator } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "creator",
    chainId,
  });
  const { data: myContribution, refetch: refetchMyContribution } = useReadContract({
    address: campaignAddress ?? undefined,
    abi: campaignAbi,
    functionName: "contributions",
    args: address ? [address] : undefined,
    chainId,
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
    contract: useCampaignContract(campaignAddress, chainId),
  };
}

export function useContribute(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const { address } = useAccount();
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId });

  function contribute(valueWei: bigint) {
    if (!campaignAddress) throw new Error("Campaign address required");
    if (valueWei <= 0n) throw new Error("Amount must be greater than zero");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "contribute",
      value: valueWei,
      chainId,
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

export function useWithdraw(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId });

  function releaseFunds() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "releaseFunds",
      chainId,
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

export function useFinalize(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId });

  function finalizeAfterDeadline() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "finalizeAfterDeadline",
      chainId,
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

export function useRefund(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId });

  function claimRefund() {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "claimRefund",
      chainId,
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

export function useVoteProposal(campaignAddress: `0x${string}` | null, chainId: number = DEFAULT_CHAIN_ID) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, chainId });

  function voteProposal(proposalId: bigint) {
    if (!campaignAddress) throw new Error("Campaign address required");
    writeContract({
      address: campaignAddress,
      abi: campaignAbi,
      functionName: "voteProposal",
      args: [proposalId],
      chainId,
    });
  }

  return {
    voteProposal,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}
